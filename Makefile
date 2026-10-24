SHELL := /bin/bash
COMPOSE := docker compose
BACKEND := uv run --directory backend
# the backend runs with cwd=backend/, so repository data paths are made absolute
LOCAL_DATA := CHARACTERISTICS_DIR=$(CURDIR)/characteristics SEED_DIR=$(CURDIR)/data/seed

.DEFAULT_GOAL := help
.PHONY: help up down logs build api fetch-seed build-seed llm-check test test-unit test-contract test-integration lint fmt check

help:
	@grep -hE '^[a-z-]+:.*##' $(MAKEFILE_LIST) | sed 's/:.*##/\t/' | expand -t24

up: ## Start PostGIS and wait until it is healthy
	$(COMPOSE) up -d --wait db

down: ## Stop the stand and keep the data volume
	$(COMPOSE) down

logs: ## Follow the stand logs
	$(COMPOSE) logs -f

build: ## Build the service images
	docker buildx bake

api: ## Run the API locally with reload against the compose database
	$(LOCAL_DATA) $(BACKEND) uvicorn hotel_agent.main:create_app --factory --reload --port 8000

fetch-seed: ## Download the raw OSM extract and DEM tiles (manual, needs network)
	bash scripts/fetch-seed.sh

build-seed: ## Cut the Sochi slice out of data/raw into data/seed/sochi (offline)
	$(BACKEND) hotel-agent build-seed --region sochi \
		--pbf $(CURDIR)/data/raw/south-fed-district-latest.osm.pbf \
		--dem $(CURDIR)/data/raw/Copernicus_DSM_COG_10_N43_00_E039_00_DEM.tif \
		      $(CURDIR)/data/raw/Copernicus_DSM_COG_10_N43_00_E040_00_DEM.tif \
		--out $(CURDIR)/data/seed/sochi

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
