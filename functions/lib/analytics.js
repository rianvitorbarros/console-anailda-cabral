"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackAnalyticsEvent = void 0;
const functions = require("firebase-functions");
const firestore_1 = require("firebase-admin/firestore");
const cors = require("cors");
const db = (0, firestore_1.getFirestore)();
const allowedOrigins = [
    'https://amulherempreedimentos.com.br',
    'https://www.amulherempreedimentos.com.br',
    'http://localhost:5173',
    'http://localhost:3000'
];
const corsHandler = cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            callback(null, false);
        }
    },
    methods: ['POST', 'OPTIONS']
});
exports.trackAnalyticsEvent = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).json({ success: false, error: 'INVALID_METHOD' });
            return;
        }
        try {
            const payload = req.body;
            if (!payload ||
                !payload.eventName ||
                !payload.sessionId ||
                !payload.visitorId) {
                console.warn('[TRACK_ANALYTICS] Payload inválido', payload);
                res.status(400).json({ success: false, error: 'INVALID_PAYLOAD' });
                return;
            }
            const projectId = 'anailda-book';
            const { eventName, sessionId, visitorId, device, browser, referrer, currentPath, metadata, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, timezone, language, screen, viewport } = payload;
            // Localização aproximada
            let country = req.headers['x-appengine-country'] || req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || req.headers['cloudfront-viewer-country'];
            let region = req.headers['x-appengine-region'] || req.headers['x-vercel-ip-country-region'];
            let city = req.headers['x-appengine-city'] || req.headers['x-vercel-ip-city'];
            let location = {
                country: country || null,
                region: region || null,
                city: city || null,
                source: (country || region || city) ? 'headers' : 'unavailable'
            };
            console.log(`[TRACK_ANALYTICS] Evento ${eventName} | Project ${projectId} | Session ${sessionId} | Visitor ${visitorId} | Path ${currentPath}`);
            console.log(`[TRACK_ANALYTICS] Location ${location.source}: ${location.country} - ${location.region} - ${location.city}`);
            const cleanMetadata = typeof metadata === 'object' && metadata !== null ? Object.assign({}, metadata) : {};
            // Remove dados sensíveis se houver no metadata (como precaução extra)
            delete cleanMetadata.email;
            delete cleanMetadata.cpf;
            delete cleanMetadata.phone;
            delete cleanMetadata.name;
            delete cleanMetadata.password;
            const eventData = {
                projectId,
                eventName,
                sessionId,
                visitorId,
                device: device || null,
                browser: browser || null,
                referrer: referrer || null,
                currentPath: currentPath || null,
                metadata: cleanMetadata,
                utmSource: utmSource || null,
                utmMedium: utmMedium || null,
                utmCampaign: utmCampaign || null,
                utmContent: utmContent || null,
                utmTerm: utmTerm || null,
                timezone: timezone || null,
                language: language || null,
                screen: screen || null,
                viewport: viewport || null,
                location,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                source: 'trackAnalyticsEvent'
            };
            const eventRef = db.collection(`projects/${projectId}/analyticsEvents`).doc();
            const sessionRef = db.doc(`projects/${projectId}/sessions/${sessionId}`);
            const sessionSnap = await sessionRef.get();
            const batch = db.batch();
            batch.set(eventRef, eventData);
            if (sessionSnap.exists) {
                batch.update(sessionRef, {
                    lastSeenAt: firestore_1.FieldValue.serverTimestamp(),
                    lastPath: currentPath || null,
                    updatedAt: firestore_1.FieldValue.serverTimestamp()
                });
                console.log(`[TRACK_ANALYTICS] Sessão atualizada: ${sessionId}`);
            }
            else {
                const sessionData = {
                    projectId,
                    sessionId,
                    visitorId,
                    startedAt: firestore_1.FieldValue.serverTimestamp(),
                    lastSeenAt: firestore_1.FieldValue.serverTimestamp(),
                    device: device || null,
                    browser: browser || null,
                    referrer: referrer || null,
                    landingPage: currentPath || null,
                    lastPath: currentPath || null,
                    utmSource: utmSource || null,
                    utmMedium: utmMedium || null,
                    utmCampaign: utmCampaign || null,
                    utmContent: utmContent || null,
                    utmTerm: utmTerm || null,
                    timezone: timezone || null,
                    language: language || null,
                    location,
                    updatedAt: firestore_1.FieldValue.serverTimestamp()
                };
                batch.set(sessionRef, sessionData);
                console.log(`[TRACK_ANALYTICS] Nova sessão criada: ${sessionId}`);
            }
            await batch.commit();
            console.log(`[TRACK_ANALYTICS] Evento salvo: ${eventRef.id}`);
            res.status(200).json({ success: true });
        }
        catch (err) {
            console.error(`[TRACK_ANALYTICS] Erro ao salvar evento:`, err);
            res.status(500).json({ success: false, error: 'FIRESTORE_WRITE_ERROR' });
        }
    });
});
//# sourceMappingURL=analytics.js.map