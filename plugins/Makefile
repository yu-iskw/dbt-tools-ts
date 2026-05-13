# Agent plugin verification (Codex + Claude + Cursor manifests and Docker CLI checks).
# Run from repo root: make -C plugins <target>
# Or: cd plugins && make <target>

REPO_ROOT := $(abspath $(CURDIR)/..)
AGENT_PLUGINS_IMAGE := dbt-tools-ts:agent-plugins
DOCKERFILE_AGENT_PLUGINS := plugins/tests/Dockerfile.agent-plugins

# VERIFY_TARGET is set per test-* target; consumed by docker run.
DOCKER_RUN_AGENT_PLUGINS = docker run --rm \
	-v $(REPO_ROOT):/work:ro \
	-e HOME=/tmp/agent-plugins-home \
	-e VERIFY_TARGET=$(VERIFY_TARGET) \
	$(AGENT_PLUGINS_IMAGE)

.DEFAULT_GOAL := help

.PHONY: help test test-all test-structural test-codex test-claude test-cursor build-image clean

help:
	@echo "Agent plugin verification (see plugins/CONTRIBUTING.md)"
	@echo ""
	@echo "  make -C plugins test              Same as test-all (VERIFY_TARGET=all)"
	@echo "  make -C plugins test-all        Full check: structural + all vendor CLIs"
	@echo "  make -C plugins test-structural Structural + marketplaces only"
	@echo "  make -C plugins test-codex      Structural + codex plugin validate"
	@echo "  make -C plugins test-claude     Structural + claude plugin validate"
	@echo "  make -C plugins test-cursor     Structural + cursor-agent plugin validate"
	@echo "  make -C plugins build-image     docker build $(AGENT_PLUGINS_IMAGE)"
	@echo "  make -C plugins clean           docker rmi $(AGENT_PLUGINS_IMAGE)"
	@echo ""

test: test-all

test-all: VERIFY_TARGET := all
test-structural: VERIFY_TARGET := structural
test-codex: VERIFY_TARGET := codex
test-claude: VERIFY_TARGET := claude
test-cursor: VERIFY_TARGET := cursor

test-all test-structural test-codex test-claude test-cursor: build-image
	cd $(REPO_ROOT) && $(DOCKER_RUN_AGENT_PLUGINS)

build-image:
	cd $(REPO_ROOT) && docker build -f $(DOCKERFILE_AGENT_PLUGINS) -t $(AGENT_PLUGINS_IMAGE) .

clean:
	-docker rmi $(AGENT_PLUGINS_IMAGE) 2>/dev/null || true
