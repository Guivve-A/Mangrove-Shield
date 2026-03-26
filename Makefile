.PHONY: test test-api test-web

test: test-api test-web

test-api:
	docker compose run --rm api pytest

test-web:
	docker compose run --rm web npm test
