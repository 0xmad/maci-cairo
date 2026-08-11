.PHONY: test coverage clean build

build:
	scarb build

test:
	rm -rf coverage
	snforge test --coverage
	lcov --remove coverage/coverage.lcov '*/tests/*' --output-file coverage/coverage.lcov
	genhtml ./coverage/coverage.lcov --output-directory coverage

coverage: test

clean:
	rm -rf coverage
