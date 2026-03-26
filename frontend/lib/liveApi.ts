import { API_BASE_URL } from "./constants";
import type { FloodStatusResponse } from "@/types/liveTypes";
import { db } from "./firebase_config";
import { doc, getDoc } from "firebase/firestore";

const STATIC_FALLBACK_URL = "/data/api_cache.json";

/**
 * Entorno 100% Local MangroveShield.
 * Esta versión ha sido simplificada para consultar ÚNICAMENTE el backend de Python
 * en localhost o el archivo estático de fallback, eliminando dependencias de la nube.
 */

export async function getFloodStatus(): Promise<FloodStatusResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/flood-status`);
        
        if (response.ok) {
            return (await response.json()) as FloodStatusResponse;
        }
        
        console.warn(`Local API returned ${response.status}, attempting Firestore fallback...`);
    } catch (error) {
        console.warn("Local API fetch failed, attempting Firestore fallback...");
    }

    // Firestore Fallback (Cloud Cache)
    try {
        const docRef = doc(db, "flood_status", "latest");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            console.log("Real-time data retrieved from Firestore cache.");
            return docSnap.data() as FloodStatusResponse;
        }
    } catch (fsError) {
        console.error("Firestore fallback failed:", fsError);
    }

    // Final Static Fallback
    console.warn("Global cache unavailable, using static fallback.");
    return await fetchStaticFallback<FloodStatusResponse>(STATIC_FALLBACK_URL);
}

async function fetchStaticFallback<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load static fallback: ${url}`);
    }
    return (await response.json()) as T;
}

/**
 * Dispara una actualización manual en el backend local.
 */
export async function triggerManualUpdate(type: "weather" | "tide" | "sar" | "ecosystem-health"): Promise<any> {
    const endpoint = `/api/v1/trigger/${type}`;
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
        });
        return await response.json();
    } catch (error) {
        console.error(`Local trigger failed for ${type}:`, error);
        throw error;
    }
}
