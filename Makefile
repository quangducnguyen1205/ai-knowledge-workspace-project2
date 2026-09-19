.PHONY: help config build up down logs ps test-spring test-processing test-frontend

COMPOSE ?= docker compose

help:
	@printf '%s\n' \
		'make config          Validate the unified Compose model' \
		'make build           Build all Project2 demo images' \
		'make up              Build and start the complete Project2 demo' \
		'make ps              Show service state' \
		'make logs            Follow all service logs' \
		'make down            Stop containers; persistent volumes are preserved' \
		'make test-spring     Run Spring tests with Maven on the host' \
		'make test-processing Run the isolated FastAPI test image' \
		'make test-frontend   Run the frontend typecheck and production build'

config:
	$(COMPOSE) config --quiet

build:
	$(COMPOSE) build

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

test-spring:
	mvn -q -f spring-product-core/services/workspace-core/pom.xml test

test-processing:
	$(COMPOSE) --profile test run --rm processing-test

test-frontend:
	$(COMPOSE) run --rm frontend npm run build

