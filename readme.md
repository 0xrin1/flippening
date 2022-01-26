# Flippening Contract



## Local setup
```sh
cp .env.example .env
npm install
npm run node
```

### Deploy contract
```sh
npx hardhat run --network local scripts/deploy.js
```

Copy the `Flippening` contract address to NETWORK_ETH_LOCAL in flippening-ui repo.