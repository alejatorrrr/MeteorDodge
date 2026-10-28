package com.alejatorrrr.meteordodge;

import android.app.Activity;
import android.os.SystemClock;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import org.json.JSONObject;

/** Bridge exposed only to the bundled HTTPS game. Ads use the native SDK, not the WebView. */
public final class RewardAds {
    private final Activity activity;
    private final WebView web;
    private final ConsentInformation consent;
    private final Slot revive = new Slot();
    private final Slot extra = new Slot();
    private boolean initializing, initialized, busy, destroyed;
    private int generation;
    private static final class Slot { RewardedAd ad; boolean loading; long loadedAt; }

    RewardAds(Activity activity, WebView web) {
        this.activity = activity; this.web = web;
        consent = UserMessagingPlatform.getConsentInformation(activity);
    }

    void startConsent() {
        consent.requestConsentInfoUpdate(activity, new ConsentRequestParameters.Builder().build(), () -> {
            if (destroyed) return;
            pauseGame();
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, error -> initializeIfAllowed());
        }, error -> initializeIfAllowed());
        // Debug is locked to Google's demo IDs; no production inventory is requested.
        if (BuildConfig.DEBUG) initializeIfAllowed();
    }

    private boolean allowed() { return BuildConfig.DEBUG || consent.canRequestAds(); }
    private void initializeIfAllowed() {
        if (destroyed || !allowed()) return;
        if (initialized) { preload(); return; }
        if (initializing) return;
        initializing = true;
        MobileAds.initialize(activity, status -> activity.runOnUiThread(() -> {
            initializing = false; initialized = true; preload();
        }));
    }
    private void preload() {
        load(revive, BuildConfig.REVIVE_AD_ID); load(extra, BuildConfig.EXTRA_AD_ID);
    }
    private void load(Slot slot, String unit) {
        if (destroyed || !initialized || !allowed() || slot.loading || slot.ad != null) return;
        slot.loading = true;
        final int expectedGeneration = generation;
        RewardedAd.load(activity, unit, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override public void onAdLoaded(RewardedAd ad) {
                if (destroyed || expectedGeneration != generation) return;
                slot.loading = false;
                if (!allowed()) return;
                slot.ad = ad; slot.loadedAt = SystemClock.elapsedRealtime();
            }
            @Override public void onAdFailedToLoad(LoadAdError error) {
                if (expectedGeneration != generation) return;
                slot.loading = false; slot.ad = null;
            }
        });
    }

    @JavascriptInterface public void showReward(String kind, String id) {
        if (id == null || !id.matches("[0-9]{1,12}")) return;
        activity.runOnUiThread(() -> {
            if (destroyed || activity.isFinishing()) return;
            if (!"revive".equals(kind) && !"extra".equals(kind)) { result(id, false, "Recompensa no disponible."); return; }
            if (busy) { result(id, false, "Ya hay un anuncio abierto."); return; }
            Slot slot = "revive".equals(kind) ? revive : extra;
            if (SystemClock.elapsedRealtime() - slot.loadedAt > 55 * 60 * 1000L) slot.ad = null;
            if (!allowed() || slot.ad == null) {
                initializeIfAllowed();
                result(id, false, "Ahora no hay anuncio disponible. Puedes seguir jugando e intentarlo más tarde."); return;
            }
            RewardedAd ad = slot.ad; slot.ad = null; busy = true; pauseGame();
            final boolean[] earned = {false};
            final boolean[] finished = {false};
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                private void finish(String message) {
                    if (finished[0]) return;
                    finished[0] = true; busy = false;
                    result(id, earned[0], message); preload();
                }
                @Override public void onAdDismissedFullScreenContent() {
                    finish(earned[0] ? "" : "Anuncio no completado. No se ha consumido tu recompensa.");
                }
                @Override public void onAdFailedToShowFullScreenContent(AdError error) {
                    finish("No se ha podido mostrar el anuncio. Puedes seguir jugando.");
                }
            });
            try {
                ad.show(activity, reward -> earned[0] = true);
            } catch (RuntimeException error) {
                if (!finished[0]) { finished[0] = true; busy = false; result(id, false, "No se ha podido abrir el anuncio."); preload(); }
            }
        });
    }

    @JavascriptInterface public void privacy() {
        activity.runOnUiThread(() -> {
            if (destroyed || busy) return;
            if (consent.getPrivacyOptionsRequirementStatus() != ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED) {
                new android.app.AlertDialog.Builder(activity).setTitle("Anuncios opcionales")
                    .setMessage(BuildConfig.DEBUG ? "Esta versión utiliza anuncios de prueba de Google y no genera ingresos. Las partidas funcionan sin conexión."
                        : "Los anuncios son opcionales. No hay opciones adicionales de consentimiento disponibles en este momento.")
                    .setPositiveButton("Aceptar", null).show(); return;
            }
            busy = true; pauseGame();
            generation++; revive.ad = null; extra.ad = null; revive.loading = false; extra.loading = false;
            UserMessagingPlatform.showPrivacyOptionsForm(activity, error -> {
                busy = false;
                if (allowed()) initializeIfAllowed();
            });
        });
    }
    private void pauseGame() {
        if (!destroyed) web.evaluateJavascript("window.dispatchEvent(new Event('app-pause'))", null);
    }
    private void result(String id, boolean earned, String message) {
        if (destroyed) return;
        String detail = "{id:" + JSONObject.quote(id) + ",earned:" + earned + ",message:" + JSONObject.quote(message) + "}";
        web.evaluateJavascript("window.dispatchEvent(new CustomEvent('meteor-ad-result',{detail:" + detail + "}))", null);
    }
    void destroy() { destroyed = true; generation++; revive.ad = null; extra.ad = null; }
}
