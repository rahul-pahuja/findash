SHELL := /bin/zsh

APP_NAME := findash-app
FRONTEND_DIR := frontend
GO_CACHE := $(CURDIR)/.gocache
PORT ?= 8080
DATA_FILE ?= $(HOME)/findash/data.json

.PHONY: help install install-frontend frontend-build frontend-dev backend-build build rebuild test check-port run run-backend start stop status logs clean clean-build clean-cache

help:
	@echo "Available targets:"
	@echo "  make install           Install frontend dependencies"
	@echo "  make frontend-build    Build the production frontend bundle"
	@echo "  make frontend-dev      Start the Vite dev server"
	@echo "  make backend-build     Build the Go binary"
	@echo "  make build             Build frontend bundle and Go binary"
	@echo "  make rebuild           Clean build artifacts and rebuild everything"
	@echo "  make test              Run Go test suite"
	@echo "  make check-port        Check whether the configured port is already in use"
	@echo "  make run               Build and run the app in the foreground"
	@echo "  make run-backend       Run the current Go binary in the foreground"
	@echo "  make start             Start the launchctl-managed daemon"
	@echo "  make stop              Stop the daemon"
	@echo "  make status            Show daemon status"
	@echo "  make logs              Tail daemon logs"
	@echo "  make clean             Remove generated build artifacts"
	@echo "  make clean-cache       Remove Go cache"

install: install-frontend

install-frontend:
	cd $(FRONTEND_DIR) && npm install

frontend-build:
	cd $(FRONTEND_DIR) && npm run build

frontend-dev:
	cd $(FRONTEND_DIR) && npm run dev

backend-build:
	mkdir -p $(GO_CACHE)
	GOCACHE=$(GO_CACHE) go build -o $(APP_NAME) .

build: frontend-build backend-build

rebuild: clean build

test:
	mkdir -p $(GO_CACHE)
	GOCACHE=$(GO_CACHE) go test ./...

check-port:
	@if lsof -nP -iTCP:$(PORT) -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "Port $(PORT) is already in use."; \
		echo "If FinDash is already running, use 'make stop' or 'make status'."; \
		echo "To run another copy, use 'make run PORT=8081'."; \
		exit 1; \
	else \
		echo "Port $(PORT) is available."; \
	fi

run: build check-port
	FINDASH_PORT=$(PORT) FINDASH_DATA=$(DATA_FILE) ./$(APP_NAME)

run-backend: check-port
	FINDASH_PORT=$(PORT) FINDASH_DATA=$(DATA_FILE) ./$(APP_NAME)

start: build
	FINDASH_PORT=$(PORT) ./findash start

stop:
	FINDASH_PORT=$(PORT) ./findash stop

status:
	FINDASH_PORT=$(PORT) ./findash status

logs:
	./findash logs

clean: clean-build

clean-build:
	rm -f $(APP_NAME)
	rm -rf $(FRONTEND_DIR)/dist

clean-cache:
	rm -rf $(GO_CACHE)
