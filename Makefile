.PHONY: test test-contracts test-circuits test-web test-web-coverage test-fuzz test-fuzz-common test-fuzz-contracts test-deploy test-deploy-coverage build coverage clean fmt fmt\:fix lint lint\:fix types-web deploy

fmt:
	scarb fmt --check
	pnpm run prettier

fmt\:fix:
	scarb fmt
	pnpm run prettier:fix

lint:
	scarb lint
	pnpm run lint:ts
	pnpm run types

lint\:fix:
	scarb lint --fix
	pnpm run lint:ts:fix

build: build-common build-contracts

build-common:
	scarb build --package maci_common

build-contracts:
	scarb build --package maci_contracts

deploy:
	pnpm --filter maci-deploy run deploy

test: test-common test-contracts test-circuits test-web test-deploy

test-contracts:
	cd contracts && rm -rf coverage
	scarb test --package maci_contracts --coverage
	cd contracts && lcov --remove coverage/coverage.lcov \
		'*/tests/*' \
		'*/common/src/*' \
 		--output-file coverage/coverage.lcov
	cd contracts && genhtml ./coverage/coverage.lcov \
 		--output-directory coverage

test-common:
	cd common && rm -rf coverage
	scarb test --package maci_common --coverage
	cd common && lcov --remove coverage/coverage.lcov '*/tests/*' \
		--output-file coverage/coverage.lcov
	cd common && genhtml ./coverage/coverage.lcov \
		--output-directory coverage

test-circuits:
	cd circuits && pnpm run test

test-web:
	cd apps/web && pnpm run test

test-deploy:
	pnpm --filter maci-deploy run test

test-deploy-coverage:
	pnpm --filter maci-deploy run test:coverage

test-web-coverage:
	cd apps/web && pnpm run test:coverage

types-web:
	cd apps/web && pnpm run types

test-fuzz: test-fuzz-common test-fuzz-contracts

test-fuzz-common:
	scarb test --package maci_common --features fuzz -- $(SNFORGE_ARGS)

test-fuzz-contracts:
	scarb test --package maci_contracts --features fuzz -- $(SNFORGE_ARGS)

clean:
	rm -rf contracts/coverage
	rm -rf common/coverage
	rm -rf apps/web/coverage
	rm -rf scripts/deploy_maci/coverage