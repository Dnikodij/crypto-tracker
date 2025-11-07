import { ref, onMounted, onUnmounted, watch, isRef, computed } from 'vue';

const coinIdToSymbolMap = {
  'bitcoin': 'BTC',
  'ethereum': 'ETH',
  'litecoin': 'LTC'
};

export function useRealtimeCryptoData(assetIdsOrRef) {
  const prices = ref({});
  const isConnected = ref(false);
  const error = ref(null);
  let socket = null;
  let subscriptions = [];

  const currentAssetIds = computed(() => {
    return isRef(assetIdsOrRef) ? assetIdsOrRef.value : assetIdsOrRef;
  });

  const connect = () => {
    disconnect();

    const assetIds = currentAssetIds.value;
    if (!assetIds || assetIds.length === 0) {
      console.warn('useRealtimeCryptoData: No asset IDs provided.');
      return;
    }

    const apiKey = '23aed295e461710c6a55ea5604ce626fb0494ea71822c0a1316dc31fed9ab223'; 

    if (!apiKey) {
        console.error('CryptoCompare API key is missing. Please add it to useRealtimeCryptoData.js');
        error.value = new Error('CryptoCompare API key is missing.');
        return;
    }

    socket = new WebSocket(`wss://streamer.cryptocompare.com/v2?api_key=${apiKey}`);

    socket.onopen = () => {
      isConnected.value = true;
      error.value = null;
      console.log('Connected to CryptoCompare WebSocket.');
      
      const assetSymbols = assetIds.map(id => coinIdToSymbolMap[id.toLowerCase()]);
      subscriptions = assetSymbols.map(symbol => `2~Coinbase~${symbol}~USD`);

      socket.send(JSON.stringify({
        action: 'SubAdd',
        subs: subscriptions
      }));
    };

    socket.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (update.TYPE === '2' && update.PRICE) {
        const fromSymbol = update.FROMSYMBOL.toUpperCase();
        const coinId = Object.keys(coinIdToSymbolMap).find(key => coinIdToSymbolMap[key] === fromSymbol);
        if (coinId) {
          prices.value = { ...prices.value, [coinId]: update.PRICE };
        }
      }
    };

    socket.onerror = (err) => {
      console.error('WebSocket Error:', err);
      error.value = new Error('WebSocket connection error.');
      isConnected.value = false;
    };

    socket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      isConnected.value = false;
    };
  };

  const disconnect = () => {
    if (socket && subscriptions.length > 0) {
      console.log('Unsubscribing and disconnecting WebSocket...');
      socket.send(JSON.stringify({
        action: 'SubRemove',
        subs: subscriptions
      }));
      socket.close();
      socket = null;
      isConnected.value = false;
      subscriptions = [];
    } else if (socket) {
      socket.close();
      socket = null;
      isConnected.value = false;
    }
  };

  watch(currentAssetIds, (newIds, oldIds) => {
    // When subscriptions change, create a new prices object
    // that only contains the keys for the new subscriptions.
    const newPrices = {};
    for (const id of newIds) {
      if (prices.value[id]) {
        newPrices[id] = prices.value[id];
      }
    }
    prices.value = newPrices;

    if (socket && socket.readyState === WebSocket.OPEN) {
      const oldSymbols = oldIds.map(id => coinIdToSymbolMap[id.toLowerCase()]);
      const newSymbols = newIds.map(id => coinIdToSymbolMap[id.toLowerCase()]);

      const oldSubs = oldSymbols.map(symbol => `2~Coinbase~${symbol}~USD`);
      const newSubs = newSymbols.map(symbol => `2~Coinbase~${symbol}~USD`);

      if (oldSubs.length > 0) {
        socket.send(JSON.stringify({ action: 'SubRemove', subs: oldSubs }));
      }
      if (newSubs.length > 0) {
        socket.send(JSON.stringify({ action: 'SubAdd', subs: newSubs }));
      }
      subscriptions = newSubs;
    } else {
      connect();
    }
  }, { deep: true });

  onMounted(connect);
  onUnmounted(disconnect);

  return {
    prices,
    isConnected,
    error,
  };
} 