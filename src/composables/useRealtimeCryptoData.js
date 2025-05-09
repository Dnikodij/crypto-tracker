import { ref, onMounted, onUnmounted, watch, isRef, computed } from 'vue';

/**
 * @typedef {Object.<string, string>} CryptoPrices
 * Key is the crypto ID (e.g., 'bitcoin'), value is the price in USD.
 */

/**
 * Connects to CoinCap WebSocket API for real-time crypto prices.
 * @param {import('vue').Ref<string[]> | string[]} assetIdsOrRef - Reactive ref or static array of crypto asset IDs to track (e.g., ref(['bitcoin', 'ethereum'])).
 * @returns {{prices: import('vue').Ref<CryptoPrices>, isConnected: import('vue').Ref<boolean>, error: import('vue').Ref<Error|null>}}
 */
export function useRealtimeCryptoData(assetIdsOrRef) {
  /** @type {import('vue').Ref<CryptoPrices>} */
  const prices = ref({});
  const isConnected = ref(false);
  const error = ref(null);
  let socket = null;

  // Ensure we are working with a computed ref for assets
  const currentAssetIds = computed(() => {
    return isRef(assetIdsOrRef) ? assetIdsOrRef.value : assetIdsOrRef;
  });

  const connect = () => {
    disconnect(); // Ensure previous connection is closed before opening a new one

    const assetIds = currentAssetIds.value;
    // Only connect if assetIds are provided
    if (!assetIds || assetIds.length === 0) {
      console.warn('useRealtimeCryptoData: No asset IDs provided or list is empty.');
      isConnected.value = false;
      // Clear prices when not connected to any assets
      prices.value = {};
      return;
    }

    const assetsQueryParam = assetIds.join(',');
    const socketUrl = `wss://ws.coincap.io/prices?assets=${assetsQueryParam}`;

    console.log('Attempting to connect to CoinCap WebSocket for:', assetsQueryParam);
    socket = new WebSocket(socketUrl);

    socket.onopen = () => {
      isConnected.value = true;
      error.value = null;
      console.log('Connected to CoinCap WebSocket for:', assetsQueryParam);
    };

    socket.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        prices.value = { ...prices.value, ...update };
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };

    socket.onerror = (err) => {
      console.error('WebSocket Error:', err);
      error.value = new Error('WebSocket connection error.');
      isConnected.value = false;
      // Consider adding reconnection logic here
    };

    socket.onclose = (event) => {
      isConnected.value = false;
      console.log('WebSocket closed:', event.code, event.reason || 'Normal closure');
      // Clear prices if the connection closes unexpectedly?
      // prices.value = {}; // Optional: depends on desired behavior
      // Consider adding reconnection logic here if closed unexpectedly
    };
  };

  const disconnect = () => {
    if (socket) {
      console.log('Disconnecting WebSocket...');
      socket.onopen = null; // Remove listeners to prevent actions on closing socket
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      socket = null;
      isConnected.value = false;
      // Don't clear prices on manual disconnect? Or maybe we should?
      // prices.value = {};
    }
  };

  // Watch for changes in the asset IDs and reconnect
  watch(currentAssetIds, (newIds, oldIds) => {
    console.log('Asset IDs changed, reconnecting WebSocket...', newIds);
    connect(); // Reconnect with the new list of assets
  }, { deep: true }); // Use deep watch if the ref itself might contain an object/array

  onMounted(() => {
    connect(); // Initial connection
  });

  onUnmounted(() => {
    disconnect(); // Clean up connection when component unmounts
  });

  return {
    prices,
    isConnected,
    error,
  };
}

// Example Usage in a component:
/*
<script setup>
import { ref } from 'vue';
import { useRealtimeCryptoData } from '@/composables/useRealtimeCryptoData';

// Define the crypto IDs you want to track (as a ref)
const selectedCoins = ref(['bitcoin', 'ethereum']);

const { prices, isConnected, error } = useRealtimeCryptoData(selectedCoins);

// Change the tracked coins later:
// selectedCoins.value = ['dogecoin', 'cardano']; // Composable will auto-reconnect
</script>
*/ 