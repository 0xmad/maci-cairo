.PHONY: test coverage clean build

build:
	scarb build

test:
	rm -rf coverage
	scarb test --coverage
	genhtml ./coverage/coverage.lcov --output-directory coverage

coverage: test

clean:
	rm -rf coverage
