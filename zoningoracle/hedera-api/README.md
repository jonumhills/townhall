# Hedera Oracle API

REST API server that receives verification data from the Chainlink CRE workflow and writes it to the Hedera smart contract.

## Architecture

```
┌──────────────┐    HTTP POST     ┌────────────┐    Transaction    ┌─────────────┐
│ CRE Workflow │─────────────────▶│ Hedera API │──────────────────▶│   Hedera    │
│  (Chainlink) │   /verify        │   Server   │    updateOracle   │  Contract   │
└──────────────┘                  └────────────┘                   └─────────────┘
```

## Why Use an API?

The CRE workflow runs in a sandboxed WASM environment and cannot directly use the Hedera SDK. This API server acts as a bridge:

1. **CRE Workflow**: Fetches data from Supabase, uploads to Walrus, computes hash
2. **HTTP Request**: CRE calls `POST /verify` with blob ID and hash
3. **API Server**: Receives request and writes to Hedera using ethers.js
4. **Result**: Returns transaction hash and block number to CRE

## Installation

```bash
npm install
```

## Configuration

The API automatically loads Hedera credentials from `../contracts/.env`:

```bash
PRIVATE_KEY=0xYOUR_HEDERA_PRIVATE_KEY
ACCOUNT_ID=0.0.YOUR_ACCOUNT
EVM_ADDRESS=0xYOUR_EVM_ADDRESS
```

## Usage

### Start Server

```bash
npm start
```

Server runs on `http://localhost:3000`

### Development Mode (with auto-reload)

```bash
npm run dev
```

## API Endpoints

### POST /verify

Write verification proof to Hedera contract.

**Request**:
```json
{
  "blobId": "PHpQ4g4Itutf2d6AToZODUQtdG_GoNEHzW9MteMI4_I",
  "petitionCount": 1087,
  "dataHash": "0x2f5d85634a847a4ca08d7e08984d6d7ce2f3d2bd9cc8659db20009b0e5bc1ac9"
}
```

**Response** (Success):
```json
{
  "success": true,
  "transaction": {
    "hash": "0x53b3ab71e3aaf6da0fac2f323e78c99750696ef6e38b46f22622c61409807334",
    "blockNumber": 32279371,
    "gasUsed": "318879",
    "timestamp": "2026-03-04T06:35:58.000Z",
    "explorerUrl": "https://hashscan.io/testnet/transaction/0x53b3ab71e3aaf6da..."
  },
  "data": {
    "blobId": "PHpQ4g4Itutf2d6AToZODUQtdG_GoNEHzW9MteMI4_I",
    "petitionCount": 1087,
    "dataHash": "0x2f5d85634a847a4ca08d7e08984d6d7ce2f3d2bd9cc8659db20009b0e5bc1ac9",
    "walrusUrl": "https://aggregator.walrus-testnet.walrus.space/v1/..."
  },
  "duration": "6234ms"
}
```

**Response** (Error):
```json
{
  "success": false,
  "error": "Only oracle can update",
  "reason": "Unauthorized"
}
```

### GET /status

Get latest verification data from the contract.

**Response**:
```json
{
  "success": true,
  "contract": "0x00000000000000000000000000000000007b3859",
  "totalSnapshots": 2,
  "latestSnapshot": {
    "blobId": "PHpQ4g4Itutf2d6AToZODUQtdG_GoNEHzW9MteMI4_I",
    "timestamp": "2026-03-04T06:35:58.000Z",
    "petitionCount": "1087",
    "dataHash": "0x2f5d85634a847a4ca08d7e08984d6d7ce2f3d2bd9cc8659db20009b0e5bc1ac9",
    "walrusUrl": "https://aggregator.walrus-testnet.walrus.space/v1/..."
  }
}
```

### GET /health

Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "contract": "0x00000000000000000000000000000000007b3859",
  "network": "hedera-testnet",
  "timestamp": "2026-03-04T06:34:34.956Z"
}
```

### GET /

API documentation and info.

## Testing

### Test with curl

```bash
# Health check
curl http://localhost:3000/health

# Get status
curl http://localhost:3000/status

# Write verification
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "blobId": "PHpQ4g4Itutf2d6AToZODUQtdG_GoNEHzW9MteMI4_I",
    "petitionCount": 1087,
    "dataHash": "0x2f5d85634a847a4ca08d7e08984d6d7ce2f3d2bd9cc8659db20009b0e5bc1ac9"
  }'
```

## Integration with CRE Workflow

The CRE workflow automatically calls this API:

```typescript
const hederaApiResponse = httpClient.sendRequest(runtime, {
  method: 'POST',
  url: 'http://localhost:3000/verify',
  headers: {
    'Content-Type': 'application/json'
  },
  body: Buffer.from(JSON.stringify({
    blobId: blobId,
    petitionCount: petitions.length,
    dataHash: dataHash
  }))
}).result();
```

## Deployment

### Production Deployment

For production, deploy the API to a cloud provider:

1. **Railway / Render / Fly.io**: Simple Node.js deployment
2. **AWS Lambda**: Serverless with API Gateway
3. **Docker**: Containerize for any platform

### Environment Variables

Set these in production:
- `PORT`: API port (default: 3000)
- `PRIVATE_KEY`: Hedera private key
- `NODE_ENV`: Set to `production`

## Security Considerations

1. **Private Key**: Never commit `.env` file
2. **CORS**: Add CORS middleware for browser access
3. **Rate Limiting**: Add rate limiting for production
4. **Authentication**: Add API key auth if public-facing
5. **HTTPS**: Use HTTPS in production

## Error Handling

The API handles:
- Invalid request format (400)
- Missing required fields (400)
- Hedera transaction failures (500)
- Network errors (500)

All errors are logged and returned with descriptive messages.

## License

MIT
