# Oncotics GitHub testing

The complete Oncotics Scenario Lab project is now in this repository.

[Passing test run](https://github.com/JAQA-Life/oncotics8055/actions/runs/37586441636): 32 integration tests and 129 original backend tests passed. All four deployment images built and passed startup checks, including OASIS imports and the Offline engine's Neo4j connection.

See [the detailed results](docs/GITHUB-RESULTS.md), [deployment guide](docs/DEPLOYMENT.md), and [validation workflow](.github/workflows/oncotics-tests.yml). Real model simulations, imaging inference, scientific validity and target-host production acceptance remain unverified.

The final documentation and refreshed source archive do not change the application code tested at f5b95873c310a311158fd2c24ba967a2353412a0. No live provider credentials are included.
