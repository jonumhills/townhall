import { useState, useEffect } from "react";
import { formatAdi } from "../utils/marketPricing";

// Use Vite proxy instead of direct URL to avoid CORS
const DURHAM_API = "/durham";

export default function AdminDurham() {
  const [pendingClaims, setPendingClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [verifiedBy, setVerifiedBy] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPendingClaims();
  }, []);

  const fetchPendingClaims = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${DURHAM_API}/token/admin/pending-claims?countyId=durham_nc`
      );
      if (!response.ok) throw new Error("Failed to fetch pending claims");
      const data = await response.json();
      setPendingClaims(data.pending_claims || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewClaim = (claim) => {
    setSelectedClaim(claim);
    setReviewNotes("");
  };

  const handleApprove = async (approved) => {
    if (!verifiedBy.trim()) {
      alert("Please enter your name/email in the 'Verified By' field");
      return;
    }

    if (
      !approved &&
      !confirm("Are you sure you want to reject this claim?")
    ) {
      return;
    }

    if (
      approved &&
      !confirm(
        "Approve this claim? This will mint the NFT with county signature on ADI Chain."
      )
    ) {
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(
        `${DURHAM_API}/token/admin/approve-claim`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            claimId: selectedClaim.id,
            approved,
            notes: reviewNotes || (approved ? "Approved" : "Rejected"),
            verifiedBy,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to process claim");
      }

      const result = await response.json();

      alert(
        approved
          ? `Claim approved! NFT minted - Token ID: ${result.mint.tokenId}\nShare Token: ${result.mint.shareTokenAddress}`
          : "Claim rejected"
      );

      setSelectedClaim(null);
      setReviewNotes("");
      fetchPendingClaims();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading pending claims...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            Error: {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Durham County Admin Dashboard
          </h1>
          <p className="text-gray-600">
            Review and approve parcel deed claims on ADI Chain
          </p>
        </div>

        <div className="mb-6 bg-white rounded-lg p-4 shadow">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Verified By (Your Name/Email)
          </label>
          <input
            type="text"
            value={verifiedBy}
            onChange={(e) => setVerifiedBy(e.target.value)}
            placeholder="e.g., admin@durham.gov"
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {pendingClaims.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No pending claims to review
          </div>
        ) : (
          <div className="grid gap-6">
            {pendingClaims.map((claim) => (
              <div
                key={claim.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">
                      Parcel PIN: {claim.pin}
                    </h2>
                    <p className="text-sm text-gray-500">
                      Submitted: {new Date(claim.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                    Pending Review
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Owner Account:</span>{" "}
                      {claim.owner_wallet}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">County:</span>{" "}
                      {claim.county_id}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Price:</span>{" "}
                      {claim.price_adi
                        ? formatAdi(claim.price_adi)
                        : "Not set"}
                    </p>
                  </div>
                  <div>
                    {claim.metadata?.parcel && (
                      <>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Address:</span>{" "}
                          {claim.metadata.parcel.address || "N/A"}
                        </p>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Zoning:</span>{" "}
                          {claim.metadata.zoning?.current || "N/A"}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {claim.deed_document_url && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Deed Document:
                    </p>
                    <button
                      onClick={() => handleReviewClaim(claim)}
                      className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
                    >
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      View Deed PDF
                    </button>
                  </div>
                )}

                <button
                  onClick={() => handleReviewClaim(claim)}
                  className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Review Claim
                </button>
              </div>
            ))}
          </div>
        )}

        {selectedClaim && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Review Claim: {selectedClaim.pin}
                </h3>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  {/* Left column - Verification checklist and notes */}
                  <div className="space-y-3">
                    <div className="bg-gray-50 p-4 rounded">
                      <h4 className="font-semibold text-gray-900 mb-2">
                        Verification Checklist
                      </h4>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>PIN matches deed document: {selectedClaim.pin}</span>
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>
                            Owner account valid: {selectedClaim.owner_wallet}
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>Document is recent and authentic</span>
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>No liens or encumbrances (if applicable)</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Review Notes (optional)
                      </label>
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        rows={3}
                        placeholder="Add any notes about this review..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Right column - PDF viewer */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">
                      Deed Document
                    </h4>
                    {selectedClaim.deed_document_url ? (
                      <div className="border border-gray-300 rounded-md overflow-hidden">
                        <iframe
                          src={selectedClaim.deed_document_url}
                          className="w-full h-[500px]"
                          title="Deed PDF Preview"
                        />
                      </div>
                    ) : (
                      <div className="border border-gray-300 rounded-md p-8 text-center text-gray-500">
                        No deed document uploaded
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setSelectedClaim(null)}
                    disabled={processing}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleApprove(false)}
                    disabled={processing}
                    className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {processing ? "Processing..." : "Reject"}
                  </button>
                  <button
                    onClick={() => handleApprove(true)}
                    disabled={processing}
                    className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {processing ? "Minting..." : "Approve & Mint"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
