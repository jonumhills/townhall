import { useState } from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';

// ── Sidebar sections config ────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: 'zoning-score',
    label: 'Zoning Score',
    icon: '🎯',
    subsections: ['Overview', 'Parameters', 'Score Bands', 'Data Sources'],
  },
  {
    id: 'smart-contract',
    label: 'Smart Contract API',
    icon: 'ℏ',
    subsections: ['Deployment', 'Interface', 'Functions', 'Integration Examples', 'REST API'],
  },
  {
    id: 'audit-log',
    label: 'Audit Log',
    icon: '📡',
    subsections: ['Overview', 'Message Format', 'Mirror Node API', 'Supabase Link'],
  },
  {
    id: 'rental-pricing',
    label: 'Rental Pricing',
    icon: '💰',
    subsections: ['Overview', 'Methodology', 'Zoning Multipliers'],
    comingSoon: true,
  },
];

// ── Zoning Score content ───────────────────────────────────────────────────────
function ZoningScoreDocs() {
  return (
    <div className="space-y-12">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">Methodology</span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v1.0</span>
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-3">Zoning Score</h1>
        <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
          A 0–100 composite score that measures the regulatory stability and lending risk of a real estate parcel,
          anchored on-chain via a Merkle proof on Hedera.
        </p>
      </div>

      <hr className="border-gray-100" />

      {/* Overview */}
      <section id="overview">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Overview</h2>
        <p className="text-gray-600 leading-relaxed mb-4">
          The Zoning Score answers a single question for lenders and verifiers:
          <span className="font-semibold text-gray-800"> "How stable and safe is this parcel as collateral?"</span>
        </p>
        <p className="text-gray-600 leading-relaxed mb-4">
          It is <em>not</em> a measure of how urban or dense a zone is. A Downtown Mixed-Use (DX) parcel with an
          active rezoning denial scores lower than a Residential (R-10) parcel with clean documentation and no
          pending changes.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex gap-3">
            <span className="text-xl">ℏ</span>
            <div>
              <div className="font-bold text-blue-900 mb-1">On-chain anchoring</div>
              <div className="text-sm text-blue-700">
                Every score is derived from petition data whose SHA-256 hash is included in a Merkle tree.
                The tree root is written to a smart contract on Hedera Testnet, giving any third party a
                cryptographic way to verify that the underlying data was not tampered with.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Parameters */}
      <section id="parameters">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Parameters & Weights</h2>
        <p className="text-gray-500 text-sm mb-2">Six parameters applied to a baseline of <strong>50</strong>. Final score is clamped to 0–100.</p>
        <p className="text-gray-500 text-sm mb-6">
          <span className="font-semibold text-gray-700">Not considered:</span> petitioner identity, parcel address, or location — only regulatory and market signals.
        </p>

        <div className="space-y-4">

          {/* Zoning Classification */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-lg">🗺️</span>
                <div>
                  <div className="font-bold text-gray-900">Zoning Classification</div>
                  <div className="text-xs text-gray-500">Rank × 5 pts — applied to the zone code (strips -CU suffix)</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-blue-700">±25</div>
                <div className="text-xs text-gray-400">max swing</div>
              </div>
            </div>
            <div className="px-5 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="text-left pb-2">Zone Codes</th>
                    <th className="text-left pb-2">Category</th>
                    <th className="text-right pb-2">Δ Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <tr><td className="py-2 font-mono text-xs text-gray-700">DX</td><td className="py-2 text-gray-600">Downtown Mixed-Use</td><td className="py-2 text-right font-bold text-green-700">+25</td></tr>
                  <tr><td className="py-2 font-mono text-xs text-gray-700">CX, TOD</td><td className="py-2 text-gray-600">Commercial / Transit-Oriented</td><td className="py-2 text-right font-bold text-green-700">+20</td></tr>
                  <tr><td className="py-2 font-mono text-xs text-gray-700">NX, OX</td><td className="py-2 text-gray-600">Neighborhood / Office Mixed-Use</td><td className="py-2 text-right font-bold text-blue-700">+15</td></tr>
                  <tr><td className="py-2 font-mono text-xs text-gray-700">RX, R-4</td><td className="py-2 text-gray-600">Residential Mixed-Use / High Density</td><td className="py-2 text-right font-bold text-blue-700">+10</td></tr>
                  <tr><td className="py-2 font-mono text-xs text-gray-700">R-6</td><td className="py-2 text-gray-600">Medium Density Residential</td><td className="py-2 text-right font-bold text-yellow-700">+5</td></tr>
                  <tr><td className="py-2 font-mono text-xs text-gray-700">R-10</td><td className="py-2 text-gray-600">Standard Residential</td><td className="py-2 text-right font-bold text-gray-500">0</td></tr>
                  <tr><td className="py-2 font-mono text-xs text-gray-700">IX, R-20</td><td className="py-2 text-gray-600">Light Industrial / Low Density</td><td className="py-2 text-right font-bold text-orange-600">−5</td></tr>
                  <tr><td className="py-2 font-mono text-xs text-gray-700">IH, R-40</td><td className="py-2 text-gray-600">Heavy Industrial / Very Low Density</td><td className="py-2 text-right font-bold text-red-500">−10</td></tr>
                  <tr><td className="py-2 font-mono text-xs text-gray-700">OS</td><td className="py-2 text-gray-600">Open Space</td><td className="py-2 text-right font-bold text-red-500">−15</td></tr>
                  <tr><td className="py-2 font-mono text-xs text-gray-700">AG, EX, CON</td><td className="py-2 text-gray-600">Agricultural / Exempt / Conservation</td><td className="py-2 text-right font-bold text-red-700">−20</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Rezoning Stability */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-lg">🏛️</span>
                <div>
                  <div className="font-bold text-gray-900">Rezoning Stability</div>
                  <div className="text-xs text-gray-500">Is there an active change of use proposed?</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-blue-700">+15 / −10</div>
                <div className="text-xs text-gray-400">swing</div>
              </div>
            </div>
            <div className="px-5 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="text-left pb-2">Condition</th>
                    <th className="text-right pb-2">Δ Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <tr><td className="py-2 text-gray-700">No proposed zoning change (stable)</td><td className="py-2 text-right font-bold text-green-700">+15</td></tr>
                  <tr><td className="py-2 text-gray-700">Active rezoning — proposed ≠ current</td><td className="py-2 text-right font-bold text-red-600">−10</td></tr>
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-3">
                An active rezoning introduces land-use uncertainty that directly impacts collateral value.
              </p>
            </div>
          </div>

          {/* Documentation */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-lg">📄</span>
                <div>
                  <div className="font-bold text-gray-900">Documentation Completeness</div>
                  <div className="text-xs text-gray-500">Is an official ordinance document linked?</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-blue-700">+10</div>
                <div className="text-xs text-gray-400">max points</div>
              </div>
            </div>
            <div className="px-5 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="text-left pb-2">Field</th>
                    <th className="text-right pb-2">Δ Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <tr><td className="py-2 text-gray-700"><code className="text-xs bg-gray-100 px-1 rounded">legislation_url</code> — official ordinance PDF on record</td><td className="py-2 text-right font-bold text-green-700">+10</td></tr>
                  <tr><td className="py-2 text-gray-700">No legislation URL</td><td className="py-2 text-right font-bold text-gray-400">0</td></tr>
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-3">
                A linked ordinance confirms the petition was formally processed and is publicly auditable.
              </p>
            </div>
          </div>

          {/* Vote / Action Outcome */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-lg">🗳️</span>
                <div>
                  <div className="font-bold text-gray-900">Vote / Action Outcome</div>
                  <div className="text-xs text-gray-500">Checks <code className="bg-gray-100 px-1 rounded">vote_result</code> first, falls back to <code className="bg-gray-100 px-1 rounded">action</code></div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-blue-700">+10 / −15</div>
                <div className="text-xs text-gray-400">swing</div>
              </div>
            </div>
            <div className="px-5 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="text-left pb-2">Result</th>
                    <th className="text-right pb-2">Δ Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <tr><td className="py-2 text-gray-700">Approved / Passed</td><td className="py-2 text-right font-bold text-green-700">+10</td></tr>
                  <tr><td className="py-2 text-gray-700">No vote recorded</td><td className="py-2 text-right font-bold text-gray-400">0</td></tr>
                  <tr><td className="py-2 text-gray-700">Withdrawn by applicant</td><td className="py-2 text-right font-bold text-yellow-600">−5</td></tr>
                  <tr><td className="py-2 text-gray-700">Denied / Rejected</td><td className="py-2 text-right font-bold text-red-600">−15</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Petition Status */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-lg">📋</span>
                <div>
                  <div className="font-bold text-gray-900">Petition Status</div>
                  <div className="text-xs text-gray-500">Final administrative resolution</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-blue-700">+5 / −10</div>
                <div className="text-xs text-gray-400">swing</div>
              </div>
            </div>
            <div className="px-5 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="text-left pb-2">Status</th>
                    <th className="text-right pb-2">Δ Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <tr><td className="py-2 text-gray-700">Approved / Finalized</td><td className="py-2 text-right font-bold text-green-700">+5</td></tr>
                  <tr><td className="py-2 text-gray-700">No status / other</td><td className="py-2 text-right font-bold text-gray-400">0</td></tr>
                  <tr><td className="py-2 text-gray-700">Pending review</td><td className="py-2 text-right font-bold text-yellow-600">−5</td></tr>
                  <tr><td className="py-2 text-gray-700">Denied</td><td className="py-2 text-right font-bold text-red-600">−10</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Lender Demand Bonus */}
          <div className="border border-purple-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-purple-50 border-b border-purple-100">
              <div className="flex items-center gap-3">
                <span className="text-lg">ℏ</span>
                <div>
                  <div className="font-bold text-gray-900">Lender Demand Signal</div>
                  <div className="text-xs text-gray-500">Unique wallet verifications in the last 30 days — anti-gamed by counting distinct wallets only</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-purple-700">+18</div>
                <div className="text-xs text-gray-400">max points</div>
              </div>
            </div>
            <div className="px-5 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="text-left pb-2">Unique Lender Wallets (30 days)</th>
                    <th className="text-right pb-2">Δ Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <tr><td className="py-2 text-gray-700">10 or more wallets</td><td className="py-2 text-right font-bold text-purple-700">+18</td></tr>
                  <tr><td className="py-2 text-gray-700">5 – 9 wallets</td><td className="py-2 text-right font-bold text-purple-600">+12</td></tr>
                  <tr><td className="py-2 text-gray-700">3 – 4 wallets</td><td className="py-2 text-right font-bold text-purple-500">+8</td></tr>
                  <tr><td className="py-2 text-gray-700">1 – 2 wallets</td><td className="py-2 text-right font-bold text-purple-400">+4</td></tr>
                  <tr><td className="py-2 text-gray-700">No verified lenders</td><td className="py-2 text-right font-bold text-gray-400">0</td></tr>
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-3">
                Each verification is logged immutably to Hedera HCS topic <code className="bg-gray-100 px-1 rounded">0.0.8323899</code>. Anonymous wallet verifications are excluded from the count.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* Score Bands */}
      <section id="score-bands">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Score Bands</h2>
        <p className="text-gray-500 text-sm mb-6">How to interpret a score for lending decisions.</p>

        <div className="space-y-3">
          {[
            { range: '80 – 100', label: 'Excellent', color: 'green',  bar: 'bg-green-500',  desc: 'Clean zoning, full documentation, no active rezoning. Strong collateral.' },
            { range: '65 – 79',  label: 'Good',      color: 'blue',   bar: 'bg-blue-500',   desc: 'Minor gaps in documentation or low-density zoning. Low lending risk.' },
            { range: '50 – 64',  label: 'Fair',      color: 'yellow', bar: 'bg-yellow-500', desc: 'Active rezoning or incomplete filings. Proceed with standard due diligence.' },
            { range: '35 – 49',  label: 'Moderate Risk', color: 'orange', bar: 'bg-orange-500', desc: 'Rezoning denied or significant documentation gaps. Elevated review required.' },
            { range: '0 – 34',   label: 'High Risk', color: 'red',    bar: 'bg-red-500',    desc: 'Multiple risk signals present. Not recommended as primary collateral.' },
          ].map(({ range, label, color, bar, desc }) => {
            const textCls   = `text-${color}-700`;
            const borderCls = `border-${color}-200`;
            const bgCls     = `bg-${color}-50`;
            return (
              <div key={range} className={`flex items-start gap-4 p-4 rounded-xl border ${bgCls} ${borderCls}`}>
                <div className={`w-3 h-12 rounded-full ${bar} shrink-0 mt-0.5`} />
                <div className="flex-1">
                  <div className="flex items-baseline gap-3 mb-1">
                    <span className={`text-lg font-black ${textCls}`}>{range}</span>
                    <span className={`text-sm font-bold ${textCls}`}>{label}</span>
                  </div>
                  <p className="text-sm text-gray-600">{desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Data Sources */}
      <section id="data-sources">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Data Sources</h2>
        <p className="text-gray-500 text-sm mb-6">Where the underlying parcel data comes from.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: '🏛️', title: 'Raleigh County Petitions', desc: 'Rezoning petition records scraped from the City of Raleigh planning portal, stored in Supabase.' },
            { icon: '🌐', title: 'GIS Parcel Layer', desc: 'Parcel boundaries and attributes from Wake County GIS open data — used for map rendering and area calculations.' },
            { icon: '🔗', title: 'Hedera Smart Contract', desc: 'Merkle root anchored on Hedera EVM Testnet. Any party can verify data integrity without trusting the platform.' },
            { icon: '📦', title: 'Walrus Decentralized Storage', desc: 'Full petition dataset uploaded to Walrus for permanent, tamper-evident off-chain storage referenced by the data hash.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="text-2xl mb-2">{icon}</div>
              <div className="font-bold text-gray-900 mb-1">{title}</div>
              <div className="text-sm text-gray-500">{desc}</div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}

// ── Code block helper ──────────────────────────────────────────────────────────
function Code({ children, language = 'solidity' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group rounded-xl overflow-hidden border border-gray-800 my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <span className="text-xs text-gray-500 font-mono">{language}</span>
        <button onClick={copy} className="text-xs text-gray-500 hover:text-white transition-colors">
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
      <pre className="bg-gray-950 text-gray-200 text-xs leading-relaxed p-5 overflow-x-auto font-mono whitespace-pre">
        {children.trim()}
      </pre>
    </div>
  );
}

// ── Smart Contract Integration docs ───────────────────────────────────────────
function SmartContractDocs() {
  return (
    <div className="space-y-12">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">On-Chain</span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">Live on Hedera Testnet</span>
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-3">Smart Contract API</h1>
        <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
          Any lending protocol, RWA tokenization platform, or DeFi vault can call the Townhall
          ZoningOracle directly from their smart contract to gate loans, verify collateral, and
          enforce zoning eligibility on-chain — no intermediaries.
        </p>
      </div>

      <hr className="border-gray-100" />

      {/* Deployment */}
      <section id="deployment">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Deployment</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {[
            { label: 'Contract Address', value: '0xa66f998b6F0Bf6792A8F5837c3D795211615F862', mono: true },
            { label: 'Network', value: 'Hedera EVM Testnet (Chain ID: 296)' },
            { label: 'Deployer', value: '0x4ebFD29cD191cf260FCA8A1908E686B0837A15Ba', mono: true },
            { label: 'Explorer', value: 'HashScan Testnet', link: 'https://hashscan.io/testnet/contract/0xa66f998b6F0Bf6792A8F5837c3D795211615F862' },
          ].map(({ label, value, mono, link }) => (
            <div key={label} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</div>
              {link
                ? <a href={link} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline font-medium">{value}</a>
                : <div className={`text-sm text-gray-800 font-medium break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
              }
            </div>
          ))}
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>Testnet only.</strong> Mainnet deployment (Hedera Chain ID 295) is planned post-hackathon. Use testnet for integration development.
        </div>
      </section>

      {/* Interface */}
      <section id="interface">
        <h2 className="text-xl font-bold text-gray-900 mb-2">IZoningOracle Interface</h2>
        <p className="text-gray-500 text-sm mb-4">
          Import this interface into your contract. No dependencies, no libraries required.
        </p>
        <Code language="solidity">{`
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IZoningOracle {

    /// @notice Emitted when parcel data is updated by the oracle.
    event ParcelUpdated(
        string indexed pin,
        string  zoningCode,
        uint8   score,
        bytes32 merkleRoot,
        uint256 updatedAt
    );

    /// @notice Returns zoning score and verification status for a PIN.
    /// @param pin  Parcel ID (e.g. "Z-36-2023", "TCZ-1-2021")
    /// @return score      0–100. 0 means not yet scored.
    /// @return verified   True if the oracle has pushed data for this PIN.
    /// @return updatedAt  Unix timestamp of last update.
    function getZoningScore(string calldata pin)
        external view
        returns (uint8 score, bool verified, uint256 updatedAt);

    /// @notice Returns full parcel record stored by the oracle.
    function getParcelData(string calldata pin)
        external view
        returns (
            string memory zoningCode,
            uint8  score,
            bytes32 merkleRoot,
            bool   verified,
            uint256 updatedAt
        );

    /// @notice Single-line eligibility gate.
    /// @param pin       Parcel ID.
    /// @param minScore  Minimum acceptable zoning score (0–100).
    /// @return True if verified AND score >= minScore.
    function isEligible(string calldata pin, uint8 minScore)
        external view returns (bool);
}
        `}</Code>
      </section>

      {/* Functions */}
      <section id="functions">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Functions Reference</h2>
        <div className="space-y-4">
          {[
            {
              sig: 'isEligible(string pin, uint8 minScore) → bool',
              gas: '~2,500 gas',
              desc: 'The primary gate function. Returns true only if the parcel has been oracle-verified AND its score meets the minimum threshold. Designed as a one-liner require() check.',
              use: 'Loan approval gates, collateral whitelisting, vault deposit guards.',
            },
            {
              sig: 'getZoningScore(string pin) → (uint8 score, bool verified, uint256 updatedAt)',
              gas: '~3,000 gas',
              desc: 'Returns the numeric score plus verification flag and timestamp. Use when you need the raw score for dynamic LTV calculations or tiered interest rates.',
              use: 'LTV ratio logic, risk-tiered interest rates, collateral scoring.',
            },
            {
              sig: 'getParcelData(string pin) → (string zoningCode, uint8 score, bytes32 merkleRoot, bool verified, uint256 updatedAt)',
              gas: '~4,000 gas',
              desc: 'Returns the full parcel record including the zoning code string and Merkle root. The merkleRoot can be verified off-chain against the Townhall Merkle API.',
              use: 'Audit trails, Merkle proof verification, zoning code enforcement.',
            },
          ].map(({ sig, gas, desc, use }) => (
            <div key={sig} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-start justify-between gap-4">
                <code className="text-xs font-mono text-purple-700 break-all">{sig}</code>
                <span className="text-xs text-gray-400 shrink-0 mt-0.5">{gas}</span>
              </div>
              <div className="px-5 py-4 space-y-2">
                <p className="text-sm text-gray-600">{desc}</p>
                <p className="text-xs text-gray-400"><span className="font-semibold text-gray-500">Use for:</span> {use}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Integration Examples */}
      <section id="integration-examples">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Integration Examples</h2>

        <h3 className="text-base font-bold text-gray-700 mt-6 mb-2">1. Lending protocol (Aave / Bonzo / Maple style)</h3>
        <Code language="solidity">{`
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IZoningOracle.sol";

contract LandLendingPool {

    IZoningOracle public immutable oracle;
    uint8 public constant MIN_ZONING_SCORE = 60;

    constructor(address _oracle) {
        oracle = IZoningOracle(_oracle);
    }

    /// @notice Approve a land-backed loan only if the parcel passes verification.
    function approveLoan(
        string memory pin,   // e.g. "Z-36-2023"
        uint256 amount,
        address borrower
    ) external {
        // Single-line gate — reverts if not eligible
        require(
            oracle.isEligible(pin, MIN_ZONING_SCORE),
            "Parcel not oracle-verified or score below threshold"
        );

        // Optionally retrieve score for dynamic LTV
        (uint8 score,,) = oracle.getZoningScore(pin);
        uint256 maxLTV = score >= 80 ? 75 : score >= 65 ? 60 : 50; // LTV %

        // ... rest of loan logic
    }
}
        `}</Code>

        <h3 className="text-base font-bold text-gray-700 mt-8 mb-2">2. RWA tokenization (Centrifuge / RWA.xyz style)</h3>
        <Code language="solidity">{`
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IZoningOracle.sol";

contract ParcelTokenizer {

    IZoningOracle public immutable oracle;

    event ParcelTokenized(string pin, uint8 score, address owner);

    constructor(address _oracle) {
        oracle = IZoningOracle(_oracle);
    }

    /// @notice Mint an NFT representing a verified land parcel.
    ///         Reverts if the parcel has not been verified by Townhall.
    function tokenize(string memory pin) external returns (uint256 tokenId) {
        (
            string memory zoningCode,
            uint8 score,
            bytes32 merkleRoot,
            bool verified,
        ) = oracle.getParcelData(pin);

        require(verified,    "Parcel not verified on Townhall");
        require(score >= 50, "Zoning score too low to tokenize");

        // Store merkleRoot in NFT metadata for independent audit
        // ... mint logic ...

        emit ParcelTokenized(pin, score, msg.sender);
    }
}
        `}</Code>

        <h3 className="text-base font-bold text-gray-700 mt-8 mb-2">3. Read oracle from JavaScript / ethers.js</h3>
        <Code language="javascript">{`
import { ethers } from "ethers";

const ORACLE_ADDRESS = "0xa66f998b6F0Bf6792A8F5837c3D795211615F862";
const HEDERA_TESTNET_RPC = "https://testnet.hashio.io/api";

const ABI = [
  "function isEligible(string pin, uint8 minScore) view returns (bool)",
  "function getZoningScore(string pin) view returns (uint8 score, bool verified, uint256 updatedAt)",
  "function getParcelData(string pin) view returns (string zoningCode, uint8 score, bytes32 merkleRoot, bool verified, uint256 updatedAt)",
];

const provider = new ethers.JsonRpcProvider(HEDERA_TESTNET_RPC);
const oracle   = new ethers.Contract(ORACLE_ADDRESS, ABI, provider);

// Check if a parcel is eligible (score >= 60)
const eligible = await oracle.isEligible("Z-36-2023", 60);
console.log("Eligible:", eligible); // true / false

// Get full data
const data = await oracle.getParcelData("Z-36-2023");
console.log("Zoning:", data.zoningCode);
console.log("Score:",  data.score.toString());
console.log("Merkle:", data.merkleRoot);
        `}</Code>
      </section>

      {/* REST API */}
      <section id="rest-api">
        <h2 className="text-xl font-bold text-gray-900 mb-2">REST API</h2>
        <p className="text-gray-500 text-sm mb-6">
          For off-chain integrations, use the Townhall HTTP API. Returns Merkle proof alongside the score.
        </p>

        <div className="space-y-4">
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">GET</span>
              <code className="text-xs font-mono text-gray-700">/query/:pin</code>
              <span className="text-xs text-gray-400 ml-auto">Merkle Oracle · localhost:3000</span>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600 mb-3">Returns the zoning score, Merkle proof, and verification status for a parcel PIN.</p>
              <Code language="json">{`
// GET http://localhost:3000/query/Z-36-2023

{
  "success": true,
  "found": true,
  "petition": {
    "number": "Z-36-2023",
    "currentZoning": "R-10",
    "proposedZoning": "NX-3",
    "status": "Approved"
  },
  "verification": {
    "isValid": true,
    "dataHash": "0xabc123...",
    "merkleProof": ["0xdef456...", "0x789abc..."],
    "merkleRoot": "0x1a2b3c..."
  },
  "score": 72
}
              `}</Code>
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">GET</span>
              <code className="text-xs font-mono text-gray-700">/api/lender/verify/:pin?county_id=raleigh_nc</code>
              <span className="text-xs text-gray-400 ml-auto">Townhall API · port 8000</span>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600 mb-3">Full lender verification including petition history, zoning score, and on-chain oracle status.</p>
              <Code language="bash">{`
curl "http://localhost:8000/api/lender/verify/Z-36-2023?county_id=raleigh_nc"
              `}</Code>
            </div>
          </div>
        </div>

        <div className="mt-6 p-5 bg-purple-50 border border-purple-200 rounded-xl">
          <div className="font-bold text-purple-900 mb-2">Want to integrate?</div>
          <p className="text-sm text-purple-700">
            The <code className="bg-purple-100 px-1 rounded">IZoningOracle.sol</code> interface is open-source.
            Copy it into your project, point it at the oracle address above, and your contract has
            immediate access to on-chain land due diligence — no API keys, no trust assumptions.
          </p>
        </div>
      </section>

    </div>
  );
}

// ── Audit Log docs ─────────────────────────────────────────────────────────────
function AuditLogDocs() {
  const HCS_TOPIC   = '0.0.8323899';
  const HASHSCAN    = `https://hashscan.io/testnet/topic/${HCS_TOPIC}`;
  const MIRROR_BASE = 'https://testnet.mirrornode.hedera.com';

  return (
    <div className="space-y-12">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">On-Chain</span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">Live on Hedera Testnet</span>
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-3">Audit Log</h1>
        <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
          Every lender verification is written immutably to a Hedera Consensus Service (HCS) topic.
          The audit trail is public, tamper-proof, and queryable by anyone — no API key required.
        </p>
      </div>

      <hr className="border-gray-100" />

      {/* Overview */}
      <section id="overview">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Overview</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {[
            { label: 'HCS Topic ID',  value: HCS_TOPIC, mono: true },
            { label: 'Network',       value: 'Hedera Testnet' },
            { label: 'Fee payer',     value: 'Townhall operator (lenders pay $0 HBAR)' },
            { label: 'Explorer',      value: 'View on HashScan ↗', link: HASHSCAN },
          ].map(({ label, value, mono, link }) => (
            <div key={label} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</div>
              {link
                ? <a href={link} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline font-medium">{value}</a>
                : <div className={`text-sm text-gray-800 font-medium break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
              }
            </div>
          ))}
        </div>

        <p className="text-gray-600 text-sm leading-relaxed">
          When a lender calls <code className="bg-gray-100 px-1 rounded text-xs">/api/lender/verify/:pin</code>, the
          backend fires a background task that: <strong>(1)</strong> inserts a row into the
          <code className="bg-gray-100 px-1 rounded text-xs mx-1">lender_verifications</code> Supabase table,
          then <strong>(2)</strong> posts a JSON message to HCS topic <code className="bg-gray-100 px-1 rounded text-xs">{HCS_TOPIC}</code>.
          The resulting <em>sequence number</em> and <em>transaction ID</em> are written back to the same Supabase row,
          creating a two-way link between the off-chain record and the on-chain log entry.
        </p>
      </section>

      {/* Message Format */}
      <section id="message-format">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Message Format</h2>
        <p className="text-gray-500 text-sm mb-4">Each HCS message is a UTF-8 JSON string with the following fields.</p>

        <Code language="json">{`
{
  "event":           "lender_verify",
  "wallet":          "0x4ebFD29cD191cf260FCA8A1908E686B0837A15Ba",
  "pin":             "Z-29-2023",
  "county_id":       "raleigh_nc",
  "risk_level":      "low",
  "score":           85,
  "verification_id": "uuid-from-supabase-row",
  "timestamp":       "2025-01-15T10:32:44.123456"
}
        `}</Code>

        <div className="mt-4 space-y-2">
          {[
            { field: 'event',           desc: 'Always "lender_verify" — identifies the event type for consumers.' },
            { field: 'wallet',          desc: 'EVM address of the lender. "anonymous" if no wallet was connected — these entries are excluded from the demand signal count.' },
            { field: 'pin',             desc: 'Parcel identifier (e.g. "Z-29-2023", "TCZ-1-2021").' },
            { field: 'county_id',       desc: 'County slug (e.g. "raleigh_nc", "durham_nc").' },
            { field: 'risk_level',      desc: '"low" (score ≥ 70) · "medium" (40–69) · "high" (< 40).' },
            { field: 'score',           desc: 'Rezoning score at the time of verification (0–100).' },
            { field: 'verification_id', desc: 'UUID of the matching row in lender_verifications — cross-references on-chain log to off-chain record.' },
            { field: 'timestamp',       desc: 'UTC ISO-8601 timestamp of when the verification was triggered.' },
          ].map(({ field, desc }) => (
            <div key={field} className="flex gap-4 py-2 border-b border-gray-100 last:border-0">
              <code className="text-xs font-mono text-purple-700 w-36 shrink-0 pt-0.5">{field}</code>
              <span className="text-sm text-gray-600">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Mirror Node API */}
      <section id="mirror-node-api">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Mirror Node API</h2>
        <p className="text-gray-500 text-sm mb-4">
          Query the public Hedera Mirror Node to read all messages from the topic without any authentication.
        </p>

        <h3 className="text-base font-bold text-gray-700 mb-2">List latest messages</h3>
        <Code language="bash">{`
curl "${MIRROR_BASE}/api/v1/topics/${HCS_TOPIC}/messages?limit=25&order=desc"
        `}</Code>

        <h3 className="text-base font-bold text-gray-700 mt-6 mb-2">Decode a single message</h3>
        <Code language="javascript">{`
// Each message.message field is base64-encoded UTF-8
const res  = await fetch("${MIRROR_BASE}/api/v1/topics/${HCS_TOPIC}/messages?limit=1&order=desc");
const { messages } = await res.json();

const raw  = atob(messages[0].message);          // base64 → string
const data = JSON.parse(raw);                    // parse JSON

console.log(data.wallet, data.pin, data.score);  // e.g. 0x4ebf... Z-29-2023 85
        `}</Code>

        <h3 className="text-base font-bold text-gray-700 mt-6 mb-2">Filter by sequence number</h3>
        <Code language="bash">{`
# Get message at sequence number 1
curl "${MIRROR_BASE}/api/v1/topics/${HCS_TOPIC}/messages/1"
        `}</Code>

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <strong>No API key required.</strong> The Hedera Mirror Node is a public read-only endpoint.
          Every message submitted to topic <code className="bg-blue-100 px-1 rounded">{HCS_TOPIC}</code> is
          permanently stored and globally readable.
        </div>
      </section>

      {/* Supabase Link */}
      <section id="supabase-link">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Supabase Link</h2>
        <p className="text-gray-600 text-sm leading-relaxed mb-4">
          The <code className="bg-gray-100 px-1 rounded text-xs">lender_verifications</code> table stores the full
          verification payload alongside the HCS references, so every off-chain record is pinned to its on-chain counterpart.
        </p>

        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <span className="text-xs font-mono text-gray-600 font-bold">lender_verifications</span>
            <span className="text-xs text-gray-400 ml-3">Supabase table schema (key columns)</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                <th className="text-left px-5 py-2">Column</th>
                <th className="text-left px-5 py-2">Type</th>
                <th className="text-left px-5 py-2">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { col: 'id',                   type: 'uuid',        desc: 'Primary key — echoed in HCS message as verification_id.' },
                { col: 'lender_wallet',        type: 'text',        desc: 'EVM address of the verifying lender.' },
                { col: 'pin',                  type: 'text',        desc: 'Parcel identifier.' },
                { col: 'county_id',            type: 'text',        desc: 'County slug.' },
                { col: 'risk_level',           type: 'text',        desc: 'low / medium / high derived from score.' },
                { col: 'verification_result',  type: 'jsonb',       desc: 'Full API response snapshot at time of verification.' },
                { col: 'hcs_topic_id',         type: 'text',        desc: `HCS topic — always ${HCS_TOPIC}.` },
                { col: 'hcs_sequence_number',  type: 'integer',     desc: 'Sequence number in the HCS topic for this message.' },
                { col: 'hcs_transaction_id',   type: 'text',        desc: 'Hedera transaction ID (e.g. 0.0.5530044@1774143386...).' },
                { col: 'verified_at',          type: 'timestamptz', desc: 'UTC timestamp of the verification.' },
              ].map(({ col, type, desc }) => (
                <tr key={col}>
                  <td className="px-5 py-2 font-mono text-xs text-purple-700">{col}</td>
                  <td className="px-5 py-2 font-mono text-xs text-gray-400">{type}</td>
                  <td className="px-5 py-2 text-gray-600 text-xs">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-800">
          To verify a specific audit entry: take the <code className="bg-purple-100 px-1 rounded">hcs_sequence_number</code> from
          the Supabase row and query <code className="bg-purple-100 px-1 rounded">
            {MIRROR_BASE}/api/v1/topics/{HCS_TOPIC}/messages/{'<sequence>'}
          </code>. The decoded message's <code className="bg-purple-100 px-1 rounded">verification_id</code> will match the Supabase row's
          primary key — proving the off-chain record and on-chain log refer to the same event.
        </div>
      </section>

    </div>
  );
}

// ── Coming Soon placeholder ────────────────────────────────────────────────────
function ComingSoonSection({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-5xl mb-4">🚧</div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">{label} Docs</h2>
      <p className="text-gray-400">This section is being written. Check back soon.</p>
    </div>
  );
}

// ── Main Docs Page ─────────────────────────────────────────────────────────────
export default function Docs() {
  const [activeSection, setActiveSection] = useState('zoning-score');

  const current = SECTIONS.find(s => s.id === activeSection);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="container mx-auto px-4 max-w-6xl py-10">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 mb-1">Documentation</h1>
          <p className="text-gray-500">Methodology, scoring models, and data sources used by Townhall.</p>
        </div>

        <div className="flex gap-8 items-start">

          {/* Sidebar */}
          <aside className="w-56 shrink-0 sticky top-24">
            <nav className="space-y-1">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => !section.comingSoon && setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition-colors ${
                    activeSection === section.id
                      ? 'bg-white shadow-sm border border-gray-200 text-gray-900 font-bold'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-white/60'
                  } ${section.comingSoon ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span>{section.icon}</span>
                  <span className="flex-1">{section.label}</span>
                  {section.comingSoon && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">Soon</span>
                  )}
                </button>
              ))}
            </nav>

            {/* Subsections */}
            {current?.subsections && (
              <div className="mt-6 pl-4 border-l border-gray-200 space-y-2">
                {current.subsections.map((sub) => (
                  <a
                    key={sub}
                    href={`#${sub.toLowerCase().replace(/\s+/g, '-')}`}
                    className="block text-xs text-gray-400 hover:text-gray-700 transition-colors py-0.5"
                  >
                    {sub}
                  </a>
                ))}
              </div>
            )}
          </aside>

          {/* Content */}
          <main className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm p-10 min-h-[600px]">
            {activeSection === 'zoning-score'   && <ZoningScoreDocs />}
            {activeSection === 'smart-contract' && <SmartContractDocs />}
            {activeSection === 'audit-log'      && <AuditLogDocs />}
            {activeSection === 'rental-pricing' && <ComingSoonSection label="Rental Pricing" />}
          </main>

        </div>
      </div>

      <Footer />
    </div>
  );
}
