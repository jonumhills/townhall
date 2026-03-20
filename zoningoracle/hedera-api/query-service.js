/**
 * Query Service - Search for parcel data in Supabase with Merkle proof verification
 */

const { ethers } = require('ethers');
const { MerkleTree } = require('merkletreejs');

// Hash function that returns Buffer — required for merkletreejs to build the
// same tree as the CRE workflow (main.ts uses viem keccak256 which also hashes raw bytes)
function keccak256(data) {
  return Buffer.from(ethers.keccak256(data).slice(2), 'hex');
}

class QueryService {
  constructor(contract, supabaseUrl, supabaseKey) {
    this.contract = contract;
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
    this.cache = new Map(); // Cache petition data and Merkle tree
  }

  /**
   * Fetch all petitions from Supabase
   */
  async fetchSupabaseData() {
    // Check cache first
    const cacheKey = 'all_petitions';
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      // Cache valid for 5 minutes
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.data;
      }
    }

    const https = require('https');
    const limit = 1000;
    let offset = 0;
    let allPetitions = [];
    let hasMore = true;

    const fetchPage = (offset) => new Promise((resolve, reject) => {
      const url = `${this.supabaseUrl}/rest/v1/petitions?select=*&order=scraped_at.desc&limit=${limit}&offset=${offset}`;
      https.get(url, {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`
        }
      }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Supabase returned status ${res.statusCode}`));
          return;
        }
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`Failed to parse Supabase data: ${e.message}`)); }
        });
      }).on('error', reject);
    });

    while (hasMore) {
      const batch = await fetchPage(offset);
      allPetitions = allPetitions.concat(batch);
      if (batch.length < limit) hasMore = false;
      else offset += limit;
    }

    this.cache.set(cacheKey, { data: allPetitions, timestamp: Date.now() });
    return allPetitions;
  }

  /**
   * Build Merkle tree from petition data
   */
  buildMerkleTree(petitions) {
    const leaves = petitions.map(p => {
      const petitionJson = JSON.stringify(p);
      return keccak256(Buffer.from(petitionJson));
    });

    return new MerkleTree(leaves, keccak256, { sortPairs: true });
  }

  /**
   * Search for a parcel by PIN or petition number in a petition dataset
   */
  findParcelByPin(petitions, searchTerm) {
    const normalized = searchTerm.trim().toUpperCase();

    for (const petition of petitions) {
      // First check if searching by petition number
      const petitionNumber = (petition.petition_number || '').trim().toUpperCase();
      if (petitionNumber === normalized) {
        return {
          petition,
          parcel: petition.pins && petition.pins[0] ? petition.pins[0] : null,
          allParcels: petition.pins || [],
          matchType: 'petition_number'
        };
      }

      // Then check PINs
      if (!petition.pins || !Array.isArray(petition.pins)) continue;

      const matchingPin = petition.pins.find(p => {
        const petitionPin = (p.pin || '').trim().toUpperCase();
        return petitionPin === normalized;
      });

      if (matchingPin) {
        return {
          petition,
          parcel: matchingPin,
          allParcels: petition.pins,
          matchType: 'pin'
        };
      }
    }

    return null;
  }

  /**
   * Query parcel by PIN - returns verification details with Merkle proof
   */
  async queryByPin(pin) {
    try {
      // Get latest Merkle root from Hedera
      const [merkleRoot, timestamp, petitionCount, dataHash] =
        await this.contract.getLatestSnapshot();

      if (petitionCount === 0n) {
        throw new Error('No verified data available yet');
      }

      // Fetch all petitions from Supabase
      const petitions = await this.fetchSupabaseData();

      // Search for the petition
      const result = this.findParcelByPin(petitions, pin);

      if (!result) {
        return {
          found: false,
          message: `Parcel PIN "${pin}" not found in Supabase data`,
          searchedIn: {
            merkleRoot,
            petitionCount: petitionCount.toString(),
            verifiedAt: new Date(Number(timestamp) * 1000).toISOString()
          }
        };
      }

      // Build Merkle tree and generate proof
      const tree = this.buildMerkleTree(petitions);
      const petitionJson = JSON.stringify(result.petition);
      const leaf = keccak256(Buffer.from(petitionJson));
      const proof = tree.getHexProof(leaf);

      // Verify proof locally
      const computedRoot = tree.getHexRoot();
      const isValid = computedRoot.toLowerCase() === merkleRoot.toLowerCase();

      // Return full verification details
      const response = {
        found: true,
        matchType: result.matchType,
        petition: {
          number: result.petition.petition_number,
          type: result.petition.petition_type,
          description: result.petition.description,
          status: result.petition.status,
          filedDate: result.petition.filed_date,
          hearingDate: result.petition.hearing_date,
          applicant: result.petition.applicant,
          totalParcels: result.allParcels.length
        },
        verification: {
          merkleRoot,
          merkleProof: proof,
          isValid,  // Whether proof verifies against on-chain root
          verifiedAt: new Date(Number(timestamp) * 1000).toISOString(),
          petitionCount: petitionCount.toString(),
          dataHash,
          hederaContract: this.contract.target,
          hederaExplorer: `https://hashscan.io/testnet/contract/${this.contract.target}`,
          howToVerify: "Hash your petition JSON, apply Merkle proof, compare to on-chain root"
        }
      };

      // Add parcel info if searching by PIN
      if (result.parcel) {
        response.parcel = {
          pin: result.parcel.pin,
          address: result.parcel.address || 'N/A',
          owner: result.parcel.owner || 'N/A',
          acreage: result.parcel.acreage || 'N/A'
        };
      }

      // Add all parcels if searching by petition number
      if (result.matchType === 'petition_number') {
        response.allParcels = result.allParcels.map(p => ({
          pin: p.pin,
          address: p.address || 'N/A'
        }));
      }

      return response;

    } catch (error) {
      throw new Error(`Query failed: ${error.message}`);
    }
  }

  /**
   * Get all snapshots history
   */
  async getSnapshotHistory() {
    try {
      const snapshotCount = await this.contract.getSnapshotCount();
      const snapshots = [];

      // Get last 10 snapshots (or all if less than 10)
      const count = Number(snapshotCount);
      const limit = Math.min(count, 10);
      const startIndex = Math.max(0, count - limit);

      for (let i = startIndex; i < count; i++) {
        const snapshot = await this.contract.getSnapshot(i);
        snapshots.push({
          index: i,
          merkleRoot: snapshot[0],
          timestamp: new Date(Number(snapshot[1]) * 1000).toISOString(),
          petitionCount: snapshot[2].toString(),
          dataHash: snapshot[3]
        });
      }

      return snapshots.reverse(); // Most recent first
    } catch (error) {
      throw new Error(`Failed to get snapshot history: ${error.message}`);
    }
  }
}

module.exports = QueryService;
