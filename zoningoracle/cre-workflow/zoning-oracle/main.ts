/**
 * Zoning Oracle CRE Workflow
 * Brings Supabase zoning petition data to blockchain via Merkle tree verification
 */

import { cre, Runner } from "@chainlink/cre-sdk";
import { keccak256, toHex } from "viem";
import { MerkleTree } from "merkletreejs";

// Configuration type
type Config = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  countyId: string;
};

/**
 * Cron trigger handler - runs every hour
 * Queries Supabase for all zoning petition data
 */
const onCronTrigger = (runtime: any, _payload: any): string => {
  runtime.log("=".repeat(70));
  runtime.log("ZONING ORACLE - Crawling Agents TO BLOCKCHAIN");
  runtime.log("=".repeat(70));

  try {
    const httpClient = new cre.capabilities.HTTPClient();

    // Fetch all petitions using pagination (Supabase limit is 1000 per request)
    runtime.log("Fetching all petitions (with pagination)...");

    let allPetitions: any[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const supabaseUrl = `${runtime.config.supabaseUrl}/rest/v1/petitions?order=scraped_at.desc&limit=${limit}&offset=${offset}`;
      runtime.log(`  Fetching batch: offset=${offset}, limit=${limit}`);

      const response = httpClient
        .sendRequest(runtime, {
          method: "GET",
          url: supabaseUrl,
          headers: {
            apikey: runtime.config.supabaseAnonKey,
            Authorization: `Bearer ${runtime.config.supabaseAnonKey}`,
            "Content-Type": "application/json",
          },
        })
        .result();

      const responseText = Buffer.from(response.body).toString("utf-8");
      const batch = JSON.parse(responseText);

      runtime.log(`  Retrieved ${batch.length} petitions`);
      allPetitions = allPetitions.concat(batch);

      if (batch.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    const petitions = allPetitions;
    runtime.log(`✅ Successfully fetched ${petitions.length} petitions`);

    // Count total parcels (each petition can have multiple pins)
    const totalParcels = petitions.reduce(
      (sum: number, p: any) => sum + (p.pins?.length || 0),
      0,
    );
    runtime.log(`📊 Total parcels to process: ${totalParcels}`);

    // Compute Merkle tree from petition data
    runtime.log("\n🌳 Computing Merkle tree from petition data...");

    // Build Merkle tree
    const leaves = petitions.map((p: any) => {
      // Hash each petition
      const petitionJson = JSON.stringify(p);
      return keccak256(toHex(petitionJson));
    });

    runtime.log(`   Generated ${leaves.length} leaf nodes`);

    // Create Merkle tree with sorted pairs (deterministic)
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const merkleRoot = tree.getHexRoot();

    runtime.log(`✅ Merkle root computed: ${merkleRoot}`);
    runtime.log(`   Tree depth: ${tree.getDepth()}`);
    runtime.log(`   Total leaves: ${leaves.length}`);

    // Also compute data hash for additional verification
    const allDataJson = JSON.stringify(petitions);
    const dataHash = keccak256(toHex(allDataJson));
    runtime.log(`\n🔐 Data Hash: ${dataHash}`);

    // Write verification proof to Hedera via API
    runtime.log("\n📡 Writing Merkle root to Hedera...");

    try {
      const hederaApiResponse = httpClient
        .sendRequest(runtime, {
          method: "POST",
          url: "http://localhost:3000/verify",
          headers: {
            "Content-Type": "application/json",
          },
          body: Buffer.from(
            JSON.stringify({
              merkleRoot: merkleRoot,
              petitionCount: petitions.length,
              dataHash: dataHash,
            })
          ).toString("base64"),
        })
        .result();

      const hederaResponseText = Buffer.from(hederaApiResponse.body).toString(
        "utf-8",
      );
      const hederaResult = JSON.parse(hederaResponseText);

      if (hederaResult.success) {
        runtime.log(`✅ Merkle root written to Hedera!`);
        runtime.log(`   Transaction: ${hederaResult.transaction.hash}`);
        runtime.log(`   Block: ${hederaResult.transaction.blockNumber}`);
        runtime.log(`   Explorer: ${hederaResult.transaction.explorerUrl}`);
      } else {
        runtime.log(`⚠️  Hedera write failed: ${hederaResult.error}`);
      }
    } catch (apiError) {
      runtime.log(`⚠️  Hedera API error: ${apiError}`);
      runtime.log(
        `   Make sure API server is running: cd hedera-api && npm start`,
      );
    }

    runtime.log("=".repeat(70));
    runtime.log("✅ WORKFLOW COMPLETE");
    runtime.log(`   Petitions fetched: ${petitions.length}`);
    runtime.log(`   Parcels processed: ${totalParcels}`);
    runtime.log(`   Merkle root: ${merkleRoot}`);
    runtime.log(`   Data hash: ${dataHash}`);
    runtime.log("=".repeat(70));

    return `Successfully processed ${petitions.length} petitions (${totalParcels} parcels) - Merkle root: ${merkleRoot}`;
  } catch (error) {
    runtime.log(`❌ Error: ${error}`);
    return `Error: ${error}`;
  }
};

/**
 * Initialize workflow with cron trigger
 */
const initWorkflow = (_config: Config) => {
  const cronCapability = new cre.capabilities.CronCapability();

  return [
    cre.handler(
      cronCapability.trigger({ schedule: "0 * * * *" }),
      onCronTrigger,
    ),
  ];
};

/**
 * Main entry point - required for CRE WASM compilation
 */
export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();
