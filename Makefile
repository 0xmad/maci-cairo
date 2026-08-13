.PHONY: test test-contracts test-circuits build coverage clean

build: build-common build-contracts build-circuits

build-common:
	scarb build --package maci_common

build-contracts:
	scarb build --package maci_contracts

build-circuits:
	scarb --profile circuit build --package maci_circuits

test: test-common test-contracts

test-contracts:
	cd common && rm -rf coverage
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
	scarb test --package maci_circuits

coverage: test-contracts

clean:
	rm -rf contracts/coverage
	rm -rf common/coverage