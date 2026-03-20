import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hedera, durham } from '../services/api';
import { estimateParcelValue, formatUsd, formatHbar, formatAdi } from '../utils/marketPricing';

/**
 * ClaimModal — 4-step flow (Option A1: manual document verification)
 *
 * Step 1: Confirm parcel details + verify deed (POST /token/verify-deed)
 * Step 2: Upload deed document (PDF)
 * Step 3: Set share price (optional) → submit claim (POST /token/submit-claim)
 * Step 4: Pending review message (claim awaits county admin approval)
 *
 * Props:
 *   parcel       {object}  — selectedParcel from MapView (properties from GeoJSON)
 *   wallet       {string}  — connected wallet (Hedera account ID or ADI address)
 *   onClose      {fn}
 *   onMinted     {fn}      — called after successful claim submission
 *   serviceType  {string}  — 'hedera' or 'durham'
 */
export default function ClaimModal({ parcel, wallet, onClose, onMinted, serviceType = 'hedera' }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [priceHbar, setPriceHbar] = useState('');
  const [deedFile, setDeedFile] = useState(null);
  const [deedFileBase64, setDeedFileBase64] = useState('');
  const [convertingFile, setConvertingFile] = useState(false);
  const [claimResult, setClaimResult] = useState(null);

  const pin = parcel?.petition_number || parcel?.pin;
  const countyId = parcel?.county_id;
  const location = parcel?.location || parcel?.address || 'Unknown location';

  const isDurham = serviceType === 'adi' || serviceType === 'durham';
  const service = isDurham ? durham : hedera;
  const chainName = isDurham ? 'ADI Chain' : 'Hedera';
  const tokenSymbol = isDurham ? 'ADI' : 'HBAR';

  console.log('🎯 ClaimModal serviceType:', serviceType, '| isDurham:', isDurham);

  // Step 1: Verify deed exists in Supabase and is unclaimed
  const handleVerify = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await service.verifyDeed({ pin, countyId, ownerAccountId: wallet });

      // Handle different response formats
      if (result.success === false || result.error) {
        setError(result.error || result.message || 'Verification failed');
        return;
      }

      // Hedera format: pin_matched, already_tokenized
      if (result.pin_matched === false) {
        setError(`PIN ${pin} not found in the registry.`);
        return;
      }
      if (result.already_tokenized) {
        setError('This parcel is already tokenized.');
        return;
      }

      // Durham format: success: true, canClaim
      if (result.success && !result.canClaim) {
        setError('This parcel cannot be claimed.');
        return;
      }

      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Handle deed document upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed');
      // Reset input so same file can be selected again
      e.target.value = '';
      return;
    }

    const maxSizeMB = 10;
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size: ${maxSizeMB}MB`);
      // Reset input so same file can be selected again
      e.target.value = '';
      return;
    }

    setDeedFile(file);
    setError('');
    setConvertingFile(true);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      setDeedFileBase64(reader.result);
      setConvertingFile(false);
      // Reset input after successful conversion so user can select same file again
      e.target.value = '';
    };
    reader.onerror = () => {
      setError('Failed to read file');
      setDeedFile(null);
      setConvertingFile(false);
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  // Step 3: Submit claim (with deed document) — county will review
  const handleSubmitClaim = async () => {
    if (!deedFileBase64) {
      setError('Please upload your deed document first');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const price = priceHbar ? parseFloat(priceHbar) : null;

      let result;
      if (isDurham) {
        result = await service.submitClaim({
          pin,
          countyId,
          ownerAccountId: wallet,
          priceAdi: price,
          deedDocumentBase64: deedFileBase64,
        });
      } else {
        // Hedera uses direct fetch for now (could be refactored to use service.submitClaim)
        const response = await fetch('/raleigh/token/submit-claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pin,
            countyId,
            ownerAccountId: wallet,
            priceHbar: price,
            deedDocumentBase64: deedFileBase64,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to submit claim');
        }

        result = await response.json();
      }

      setClaimResult(result);
      setStep(4);
      onMinted(); // refresh map (pending claims could be shown differently)
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          className="relative z-10 bg-black/95 border border-amber-500/30 rounded-3xl shadow-2xl shadow-amber-500/10 w-full max-w-md mx-4 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 px-6 py-4 border-b border-amber-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <h2 className="text-amber-400 font-black text-base uppercase tracking-wide">Claim Parcel</h2>
                <p className="text-gray-500 text-xs">Step {step} of 4</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-red-500/20 rounded-lg text-gray-500 hover:text-red-400 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex gap-1 px-6 pt-4">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-amber-500' : 'bg-white/10'}`}
              />
            ))}
          </div>

          <div className="p-6">
            {/* ── Step 1: Confirm & Verify ── */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-sm mb-3">Confirm you own this parcel to claim it on {chainName}.</p>
                  <div className="bg-white/5 rounded-2xl p-4 space-y-2 border border-white/10">
                    <Row label="PIN" value={pin} mono />
                    <Row label="County" value={countyId} />
                    <Row label="Location" value={location} />
                    {parcel?.current_zoning && <Row label="Current Zoning" value={parcel.current_zoning} />}
                    {parcel?.proposed_zoning && <Row label="Proposed Zoning" value={parcel.proposed_zoning} />}
                  </div>
                </div>

                {/* Estimated market value */}
                {parcel?.current_zoning && (() => {
                  const { valueUsd, valueHbar, valueAdi, valueHbarPerShare, valueAdiPerShare, acreage, areaSqft } = estimateParcelValue(parcel.current_zoning, parcel.area_sqft || null);
                  const primaryValue = isDurham ? formatAdi(valueAdi) : formatHbar(valueHbar);
                  const perShareValue = isDurham ? valueAdiPerShare : valueHbarPerShare;
                  const exchangeRate = isDurham ? '$2.50' : '$0.18';

                  return (
                    <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border border-emerald-500/30 rounded-2xl p-4">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Est. Market Value</p>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-emerald-400 font-black text-xl">{primaryValue}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{formatUsd(valueUsd)} · @{exchangeRate}/{tokenSymbol}</p>
                          {acreage && (
                            <p className="text-gray-600 text-xs mt-0.5">{acreage} ac · {Math.round(areaSqft).toLocaleString()} sqft</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-gray-400 text-xs">Per share (1,000 total)</p>
                          <p className="text-amber-400 font-bold text-sm">{perShareValue} {tokenSymbol} / share</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
                  <p className="text-xs text-gray-500 mb-1">Your Wallet</p>
                  <p className="text-emerald-400 font-mono text-sm">{wallet}</p>
                </div>

                {error && <ErrorBox message={error} />}

                <button
                  onClick={handleVerify}
                  disabled={loading}
                  className="w-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 font-black py-3 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Spinner text="Verifying..." /> : 'Verify Ownership →'}
                </button>
              </div>
            )}

            {/* ── Step 2: Upload Deed Document ── */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-emerald-400 text-sm font-medium">Parcel verified — upload your deed document</p>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
                  <p className="text-gray-400 text-sm">
                    Upload a PDF copy of your property deed. This will be reviewed by the county legislator before minting your NFT.
                  </p>

                  <div>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="deed-upload"
                    />
                    <div
                      onClick={() => {
                        const input = document.getElementById('deed-upload');
                        // Reset value before clicking to ensure onChange fires even for same file
                        input.value = '';
                        input.click();
                      }}
                      className="cursor-pointer border-2 border-dashed border-white/20 hover:border-amber-500/40 rounded-xl p-6 text-center transition-colors"
                    >
                      {deedFile ? (
                        <div className="flex items-center justify-center gap-3">
                          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="text-left">
                            <p className="text-white text-sm font-medium">{deedFile.name}</p>
                            <p className="text-gray-500 text-xs">{(deedFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <svg className="w-10 h-10 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-gray-400 text-sm font-medium">Click to upload deed PDF</p>
                          <p className="text-gray-600 text-xs mt-1">Max size: 10MB</p>
                        </>
                      )}
                    </div>
                  </div>

                  {deedFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeedFile(null);
                        setDeedFileBase64('');
                        setConvertingFile(false);
                      }}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      disabled={convertingFile}
                    >
                      Remove file
                    </button>
                  )}

                  {convertingFile && (
                    <div className="flex items-center gap-2 text-xs text-amber-400">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Processing file...
                    </div>
                  )}
                </div>

                {error && <ErrorBox message={error} />}

                <button
                  onClick={() => setStep(3)}
                  disabled={!deedFile || convertingFile || !deedFileBase64}
                  className="w-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 font-black py-3 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {convertingFile ? <Spinner text="Processing file..." /> : 'Continue to Price →'}
                </button>
              </div>
            )}

            {/* ── Step 3: Set Price & Submit Claim ── */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-emerald-400 text-sm font-medium">Deed uploaded — set your price</p>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2">
                  <p className="text-gray-400 text-xs">What happens next:</p>
                  <div className="flex items-center gap-2 text-sm text-white">
                    <span className="text-amber-400">1.</span> County legislator reviews your deed document
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white">
                    <span className="text-amber-400">2.</span> If approved, NFT minted with county signature
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white">
                    <span className="text-amber-400">3.</span> 1,000 fungible shares transferred to your wallet
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    Price per Share ({tokenSymbol}) — optional
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="e.g. 5"
                    value={priceHbar}
                    onChange={(e) => setPriceHbar(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500/50 placeholder-gray-600"
                  />
                  {parcel?.current_zoning && (() => {
                    const { valueHbarPerShare, valueAdiPerShare } = estimateParcelValue(parcel.current_zoning, parcel.area_sqft || null);
                    const perShareValue = isDurham ? valueAdiPerShare : valueHbarPerShare;
                    return (
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-gray-600 text-xs">You can also set the price later from your portfolio.</p>
                        <button
                          type="button"
                          onClick={() => setPriceHbar(String(perShareValue))}
                          className="text-xs text-amber-500 hover:text-amber-400 font-bold transition-colors"
                        >
                          Use est. {perShareValue} {tokenSymbol}/share
                        </button>
                      </div>
                    );
                  })()}
                  {!parcel?.current_zoning && (
                    <p className="text-gray-600 text-xs mt-1">You can also set the price later from your portfolio.</p>
                  )}
                </div>

                {error && <ErrorBox message={error} />}

                <button
                  onClick={handleSubmitClaim}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-600/30 to-orange-600/30 hover:from-amber-600/50 hover:to-orange-600/50 border border-amber-500/40 text-amber-400 font-black py-3 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Spinner text="Submitting claim..." /> : 'Submit Claim for Review'}
                </button>
                <p className="text-gray-600 text-xs text-center">County legislator will review and approve your claim</p>
              </div>
            )}

            {/* ── Step 4: Pending Review ── */}
            {step === 4 && claimResult && (
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-black text-lg">Claim Submitted!</h3>
                  <p className="text-gray-400 text-sm mt-1">
                    Your claim is pending county legislator review.
                  </p>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2 text-left">
                  <Row label="Claim ID" value={claimResult.claimId || claimResult.claim_id} mono />
                  <Row label="PIN" value={pin} mono />
                  <Row label="Status" value={claimResult.status || "Pending Review"} />
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-left">
                  <p className="text-yellow-400 text-sm font-medium mb-2">What happens next:</p>
                  <ul className="space-y-2 text-gray-400 text-xs">
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-400 shrink-0">1.</span>
                      <span>County legislator reviews your deed document</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-400 shrink-0">2.</span>
                      <span>If approved, NFT is minted with county signature on {chainName}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-400 shrink-0">3.</span>
                      <span>You'll receive your 1,000 shares in your wallet</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={onClose}
                  className="w-full bg-white/5 border border-white/10 text-gray-300 font-bold py-3 rounded-2xl hover:bg-white/10 transition-all"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-gray-500 text-xs uppercase tracking-wider shrink-0">{label}</span>
      <span className={`text-white text-xs text-right ${mono ? 'font-mono' : 'font-medium'} break-all`}>{value || '—'}</span>
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
      <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-red-400 text-sm">{message}</p>
    </div>
  );
}

function Spinner({ text }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {text}
    </span>
  );
}
