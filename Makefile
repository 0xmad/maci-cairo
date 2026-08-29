.PHONY: test test-contracts test-circuits test-fuzz test-fuzz-common test-fuzz-contracts build coverage clean

build: build-common build-contracts

build-common:
	scarb build --package maci_common

build-contracts:
	scarb build --package maci_contracts

test: test-common test-contracts test-circuits

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

test-fuzz: test-fuzz-common test-fuzz-contracts

test-fuzz-common:
	scarb test --package maci_common --features fuzz

test-fuzz-contracts:
	scarb test --package maci_contracts --features fuzz

clean:
	rm -rf contracts/coverage
	rm -rf common/coverage