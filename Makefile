SHELL := /bin/bash
COMPOSE := docker compose
BACKEND := uv run --directory backend

.DEFAULT_GOAL := help
.PHONY: help up down logs build api test test-unit test-contract test-integration lint fmt check

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
	$(BACKEND) uvicorn hotel_agent.main:create_app --factory --reload --port 8000

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
