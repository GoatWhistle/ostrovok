SHELL := /bin/bash
COMPOSE := docker compose
BACKEND := uv run --directory backend
# the backend runs with cwd=backend/, so repository data paths are made absolute
LOCAL_DATA := CHARACTERISTICS_DIR=$(CURDIR)/characteristics SEED_DIR=$(CURDIR)/data/seed
DOTENV := set -a; [ -f .env ] && . ./.env || true; set +a;

.DEFAULT_GOAL := help
.PHONY: help up down logs build api fetch-seed fetch-russia build-seed seed ingest-russia precompute refresh-facts metrics plan-questions llm-check test test-unit test-contract test-integration lint fmt check

help:
	@grep -hE '^[a-z-]+:.*##' $(MAKEFILE_LIST) | sed 's/:.*##/\t/' | expand -t24

up: build ## Build and start the full stand, including migrations
	$(COMPOSE) up -d --wait

down: ## Stop the stand and keep the data volume
	$(COMPOSE) down

logs: ## Follow the stand logs
	$(COMPOSE) logs -f

build: ## Build the service images
	$(DOTENV) docker buildx bake

api: ## Run the API locally with reload against the compose database
	$(DOTENV) $(LOCAL_DATA) $(BACKEND) uvicorn hotel_agent.main:create_app --factory --reload --port 8000

fetch-seed: ## Download the raw OSM extract and DEM tiles (manual, needs network)
	bash scripts/fetch-seed.sh

fetch-russia: ## Download and verify the full Russia OSM snapshot (manual, needs network)
	bash scripts/fetch-russia.sh

build-seed: ## Cut the Sochi slice out of data/raw into data/seed/sochi (offline)
	$(BACKEND) hotel-agent build-seed --region sochi \
		--pbf $(CURDIR)/data/raw/south-fed-district-latest.osm.pbf \
		--dem $(CURDIR)/data/raw/Copernicus_DSM_COG_10_N43_00_E039_00_DEM.tif \
		      $(CURDIR)/data/raw/Copernicus_DSM_COG_10_N43_00_E040_00_DEM.tif \
		--out $(CURDIR)/data/seed/sochi

seed: ## Load the prepared Sochi slice into the running PostGIS database
	$(DOTENV) DATABASE_URL=postgresql://$${POSTGRES_USER:-hotel}:$${POSTGRES_PASSWORD:-hotel}@localhost:$${POSTGRES_PORT:-5432}/$${POSTGRES_DB:-hotel} \
		$(LOCAL_DATA) $(BACKEND) hotel-agent ingest --region sochi --from $(CURDIR)/data/seed/sochi

ingest-russia: ## Stream selected Russia OSM layers into PostGIS with a disk-space guard
	$(DOTENV) DATABASE_URL=postgresql://$${POSTGRES_USER:-hotel}:$${POSTGRES_PASSWORD:-hotel}@localhost:$${POSTGRES_PORT:-5432}/$${POSTGRES_DB:-hotel} \
		$(BACKEND) hotel-agent ingest-pbf --region russia \
		--pbf $(CURDIR)/data/raw/$${RUSSIA_SNAPSHOT:-russia-261024}.osm.pbf \
		--layers $${RUSSIA_LAYERS:-hotels pois} --min-free-gib $${RUSSIA_MIN_FREE_GIB:-6} \
		--building-radius-m $${RUSSIA_BUILDING_RADIUS_M:-0}

precompute: ## Compute characteristic facts from the loaded region
	$(DOTENV) DATABASE_URL=postgresql://$${POSTGRES_USER:-hotel}:$${POSTGRES_PASSWORD:-hotel}@localhost:$${POSTGRES_PORT:-5432}/$${POSTGRES_DB:-hotel} \
		$(LOCAL_DATA) $(BACKEND) hotel-agent precompute --region sochi --from $(CURDIR)/data/seed/sochi

metrics: ## Report characteristic coverage and the share answered by hoteliers
	$(DOTENV) DATABASE_URL=postgresql://$${POSTGRES_USER:-hotel}:$${POSTGRES_PASSWORD:-hotel}@localhost:$${POSTGRES_PORT:-5432}/$${POSTGRES_DB:-hotel} \
		$(LOCAL_DATA) $(BACKEND) hotel-agent metrics --region sochi

refresh-facts: ## Recheck facts whose validity expired and record what changed
	$(DOTENV) DATABASE_URL=postgresql://$${POSTGRES_USER:-hotel}:$${POSTGRES_PASSWORD:-hotel}@localhost:$${POSTGRES_PORT:-5432}/$${POSTGRES_DB:-hotel} \
		$(LOCAL_DATA) $(BACKEND) hotel-agent refresh-facts --region sochi --from $(CURDIR)/data/seed/sochi

plan-questions: ## Queue hotelier questions for registry characteristics without facts
	$(DOTENV) DATABASE_URL=postgresql://$${POSTGRES_USER:-hotel}:$${POSTGRES_PASSWORD:-hotel}@localhost:$${POSTGRES_PORT:-5432}/$${POSTGRES_DB:-hotel} \
		$(LOCAL_DATA) $(BACKEND) hotel-agent plan-questions --region sochi

llm-check: ## Call the configured LLM provider for real (manual, spends quota)
	set -a; . ./.env; set +a; LLM_PROVIDER=openai_compat $(LOCAL_DATA) $(BACKEND) python scripts/llm_check.py

test: test-unit test-contract ## Run every test that needs nothing started

test-unit: ## Run tests that need nothing started
	$(BACKEND) pytest tests/unit

test-contract: ## Check API responses against docs/api/openapi.yaml
	$(BACKEND) pytest tests/contract

test-integration: ## Run tests that need PostGIS and dbmate
	$(BACKEND) pytest tests/integration

lint: ## Run ruff, mypy and the import contract
	$(BACKEND) ruff check .
	$(BACKEND) ruff format --check .
	$(BACKEND) mypy .
	$(BACKEND) lint-imports

fmt: ## Apply ruff formatting and import order
	$(BACKEND) ruff check --fix .
	$(BACKEND) ruff format .

check: lint test ## Run every check that needs nothing started

fetch-map-layers:
	python3 scripts/fetch-map-layers.py

fetch-basemap:
	bash scripts/fetch-basemap.sh

fetch-basemap-russia: ## Extract the Russia basemap (about 13 GB) and prepare it for the stand
	bash scripts/fetch-basemap-russia.sh

import-map-layers:
	$(BACKEND) python scripts/import_map_layers.py --root $(CURDIR)
