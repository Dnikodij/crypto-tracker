<template>
  <v-container>
    <!-- Time Range Selection -->
    <v-row>
      <v-col cols="12" class="d-flex align-center">
        <v-select
            v-model="selectedRange"
            :items="rangeOptions"
            label="Select Time Range (days)"
            dense
            outlined
        ></v-select>
      </v-col>
    </v-row>
    <!-- Coin Selection -->
    <v-row>
      <v-col cols="12">
        <v-select
            v-model="selectedCoins"
            :items="coinOptions"
            item-title="name"
            item-value="id"
            label="Select Cryptocurrencies"
            multiple
            chips
        ></v-select>
      </v-col>
    </v-row>
    <!-- Price Alert Setup -->
    <v-row>
      <v-col cols="12" class="d-flex align-center">
        <v-select
            v-model="alertCoin"
            :items="coinOptions"
            item-title="name"
            item-value="id"
            label="Select Coin for Alert"
            dense
            outlined
        ></v-select>
        <v-text-field
            v-model="alertPrice"
            label="Target Price (USD)"
            type="number"
            dense
            outlined
            class="ml-4"
        ></v-text-field>
        <v-btn color="primary" class="ml-4" @click="setPriceAlert">
          Set Alert
        </v-btn>
      </v-col>
    </v-row>
    <!-- Loading & Error Display -->
    <v-row>
      <v-col cols="12">
        <v-progress-linear
            v-if="isLoading"
            indeterminate
            color="primary"
            class="mb-4"
        ></v-progress-linear>
        <v-alert
            v-if="errorMessage"
            type="error"
            dismissible
            class="mb-4"
        >
          {{ errorMessage }}
        </v-alert>
      </v-col>
    </v-row>
    <!-- Chart Display -->
    <v-row>
      <v-col cols="12">
        <highcharts :options="chartOptions" ref="chartRef" />
      </v-col>
    </v-row>

    <!-- Real-time Prices -->
    <v-row v-if="isRealtimeConnected && Object.keys(realtimePrices).length > 0">
      <v-col cols="12">
        <v-card outlined class="mt-4">
          <v-card-title>Live Prices (USD)</v-card-title>
          <v-card-text>
            <v-chip
              v-for="(price, id) in realtimePrices"
              :key="id"
              class="ma-1"
              color="green"
              label
              text-color="white"
            >
              {{ coinOptions.find(c => c.id === id)?.name || id }}: ${{ parseFloat(price).toFixed(2) }}
            </v-chip>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-row v-else-if="!isRealtimeConnected">
       <v-col cols="12">
         <v-alert type="info" dense outlined class="mt-4">
           Real-time data connection status: {{ realtimeError ? 'Error' : 'Disconnected' }}
           <span v-if="realtimeError"> - {{ realtimeError.message }}</span>
         </v-alert>
       </v-col>
    </v-row>

    <!-- Snackbar Notification -->
    <v-snackbar v-model="showSnackbar" timeout="5000" color="success">
      {{ snackbarMessage }}
    </v-snackbar>
  </v-container>
</template>

<script>
import { ref, onMounted, watch, nextTick } from 'vue'
import axios from 'axios'
import { db } from '../firebase.js'
import { collection, addDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore'
import { useRealtimeCryptoData } from '../composables/useRealtimeCryptoData'
import Highcharts from 'highcharts'; // Import Highcharts if needed for addPoint access
import { Chart } from 'highcharts-vue'; // Assuming this is the component used

export default {
  name: 'CryptoChart',
  components: {
    highcharts: Chart // Register the highcharts-vue component
  },
  setup() {
    const MAX_LIVE_POINTS = 120; // Keep roughly the last ~2 minutes of frequent updates

    // Available coins for selection
    const coinOptions = [
      { id: 'bitcoin', name: 'Bitcoin' },
      { id: 'ethereum', name: 'Ethereum' },
      { id: 'litecoin', name: 'Litecoin' },
    ]
    // Default selection for charting
    const selectedCoins = ref([coinOptions[0].id])
    // Reference to the chart instance
    const chartRef = ref(null);
    // Initial chart options
    const chartOptions = ref({
      chart: { type: 'line', zoomType: 'x' }, // zoomType might be less relevant for live view
      title: { text: 'Cryptocurrency Prices' }, // Title will be updated dynamically
      xAxis: {
          type: 'datetime', // Use time-based axis for live data
          // categories: [] // Remove categories for datetime axis
      },
      yAxis: { title: { text: 'Price in USD' } },
      plotOptions: { // Default plot options
          series: {
              marker: { enabled: false },
              dataLabels: { enabled: false },
          }
       },
      series: [] // Start with empty series
    })
    // Time range options and default (days)
    const rangeOptions = [
      { title: 'Live (Last Hour)', value: 1 }, // Use object for better label
      { title: '7 Days', value: 7 },
      { title: '30 Days', value: 30 }
    ]
    const selectedRange = ref(rangeOptions[0].value) // Default to Live
    // Loading and error states
    const isLoading = ref(false)
    const errorMessage = ref('')
    // Price Alerts stored in Firestore
    const priceAlerts = ref([])
    // Inputs for setting a new price alert
    const alertCoin = ref(coinOptions[0].id)
    const alertPrice = ref('')
    // Snackbar state for notifications
    const showSnackbar = ref(false)
    const snackbarMessage = ref('')

    // --- Real-time Data Setup ---
    const {
      prices: realtimePrices,
      isConnected: isRealtimeConnected,
      error: realtimeError
    } = useRealtimeCryptoData(selectedCoins)

    // Real-time subscription: Load price alerts from Firestore
    onMounted(() => {
      const alertsCol = collection(db, 'priceAlerts');
      onSnapshot(alertsCol, snapshot => {
        priceAlerts.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      });
      // Initial setup based on default selectedRange
      setupChartForRange(selectedRange.value);
    });

    // Function to add a new price alert to Firestore
    const setPriceAlert = async () => {
      if (!alertCoin.value || !alertPrice.value) return
      try {
        const alertsCol = collection(db, 'priceAlerts')
        await addDoc(alertsCol, {
          coinId: alertCoin.value,
          targetPrice: Number(alertPrice.value),
          createdAt: new Date()
        })
        // Reset input fields after setting alert
        alertCoin.value = coinOptions[0].id
        alertPrice.value = ''
      } catch (error) {
        console.error("Error setting price alert:", error)
      }
    }

    // Fetch market chart data for a specific coin using the selected time range
    const fetchCoinData = async (coinId) => {
      try {
        const response = await axios.get(
            `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`,
            {
              params: {
                vs_currency: 'usd',
                days: selectedRange.value
              }
            }
        )
        return response.data
      } catch (error) {
        throw new Error(`Error fetching data for ${coinId}`)
      }
    }

    // Check LIVE prices against stored price alerts using data from WebSocket
    const checkLivePriceAlerts = async () => {
      const currentPrices = realtimePrices.value;
      if (!currentPrices || Object.keys(currentPrices).length === 0) return; // No live prices yet

      for (const alert of priceAlerts.value) {
        const livePrice = currentPrices[alert.coinId];
        if (livePrice !== undefined) { // Check if we have a live price for the alerted coin
          const numericLivePrice = Number(livePrice);
          if (numericLivePrice >= alert.targetPrice) {
            const coinName = coinOptions.find(c => c.id === alert.coinId)?.name || alert.coinId;
            snackbarMessage.value = `LIVE Alert: ${coinName} has reached $${numericLivePrice.toFixed(2)}`;
            showSnackbar.value = true;
            // Remove alert from Firestore
            try {
              console.log(`Attempting to delete alert ${alert.id} for ${coinName} which reached ${numericLivePrice.toFixed(2)} (target: ${alert.targetPrice})`);
              await deleteDoc(doc(db, 'priceAlerts', alert.id));
               console.log(`Deleted alert ${alert.id} for ${coinName}`);
            } catch (error) {
               console.error(`Error deleting alert ${alert.id}:`, error);
            }
          }
        }
      }
    };

    // Watch for updates in real-time prices to add points or update last point
    watch(realtimePrices, (newPrices) => {
      if (!isRealtimeConnected.value || selectedRange.value !== 1) {
          // Only add points if connected AND in live mode
          return;
      }
      if (!newPrices || Object.keys(newPrices).length === 0) return;

      // Get the Highcharts chart instance
      // Accessing the chart instance might depend on the highcharts-vue wrapper.
      // Common ways include using a ref on the component or accessing it via chartOptions callbacks.
      // We will assume direct modification of chartOptions.series triggers internal updates,
      // but direct chart instance access might be needed for addPoint.
      // For now, we stick to modifying chartOptions.value.series, which is less efficient for addPoint.
      // --> Let's try direct instance access IF AVAILABLE.
      const chart = chartRef.value?.chart; // Get chart instance if ref is set up
      if (!chart) {
          console.warn("Chart instance not available for adding points.");
          // Fallback or alternative: Modify chartOptions.value.series (less ideal for addPoint)
          return;
      }

      const currentSeries = chart.series; // Access series from the chart instance
      if (!currentSeries || currentSeries.length === 0) return; // Chart not ready or mode mismatch

      Object.entries(newPrices).forEach(([coinId, price]) => {
        const numericPrice = Number(price);
        const timestamp = Date.now();

        const seriesIndex = chart.series.findIndex(s => s.name === (coinOptions.find(c => c.id === coinId)?.name || coinId));

        if (seriesIndex !== -1) {
            const series = chart.series[seriesIndex];
            const shift = series.data.length >= MAX_LIVE_POINTS; // Shift if exceeds max points

            // Add the new point using Highcharts API
            series.addPoint([timestamp, numericPrice], true, shift);
        }
      });

      // Also check alerts with the latest prices
      checkLivePriceAlerts();
    }, { deep: true });

    // Setup chart based on selected time range
    function setupChartForRange(range) {
        // Clear existing series data safely
        if (chartRef.value?.chart) {
            while (chartRef.value.chart.series.length > 0) {
                 chartRef.value.chart.series[0].remove(false); // remove without redraw
            }
            chartRef.value.chart.redraw(); // redraw once after removing all
        }
         chartOptions.value.series = []; // Also clear the options ref

        if (range === 1) {
            // --- Live Mode Setup ---
            isLoading.value = true; // Show loading briefly
            errorMessage.value = '';
            chartOptions.value.title.text = 'Live Cryptocurrency Prices (Last Hour View)';
            chartOptions.value.xAxis.type = 'datetime';
            // Remove fixed categories if they exist from previous state
            // delete chartOptions.value.xAxis.categories;

            // Fetch initial prices to start the lines
            fetchInitialPrices(selectedCoins.value).then(initialData => {
                chartOptions.value.series = initialData;
                isLoading.value = false;
            }).catch(err => {
                errorMessage.value = 'Failed to fetch initial prices.';
                isLoading.value = false;
            });

        } else {
            // --- Historical Mode Setup ---
            chartOptions.value.xAxis.type = 'categories'; // Switch back if needed, or keep datetime?
                                                          // Let's keep datetime and format labels
             chartOptions.value.xAxis.type = 'datetime';
             chartOptions.value.xAxis.dateTimeLabelFormats = { // Format labels for days
                day: '%e %b',
                week: '%e %b', // Adjust as needed
                month: '%b \'%y',
             };
            // Use the existing updateChart for historical data
            updateChart();
        }
    }

    // Fetch initial prices for selected coins (e.g., from CoinCap REST API)
    async function fetchInitialPrices(coinIds) {
       if (!coinIds || coinIds.length === 0) return [];
       try {
           const ids = coinIds.join(',');
           // Use CoinCap REST API v2 for current prices
           const response = await axios.get(`https://api.coincap.io/v2/assets?ids=${ids}`);
           const timestamp = Date.now();
           return coinIds.map(id => {
               const assetData = response.data.data.find(asset => asset.id === id);
               const price = assetData ? parseFloat(assetData.priceUsd) : null;
               const coin = coinOptions.find(c => c.id === id);
               return {
                   name: coin ? coin.name : id,
                   data: price !== null ? [[timestamp, price]] : [] // Start with one point
               };
           });
       } catch (error) {
           console.error("Error fetching initial prices:", error);
           throw new Error('Failed to fetch initial prices.');
       }
    }

    // Fetches and updates chart with HISTORICAL data (for 7/30 day views)
    const updateChart = async () => {
      isLoading.value = true
      errorMessage.value = ''
      try {
        const promises = selectedCoins.value.map(coinId => fetchCoinData(coinId))
        const results = await Promise.all(promises)

        const currentRange = selectedRange.value;
        let chartTitle = `Cryptocurrency Prices (USD) - Last ${currentRange} Days`;

        // Map historical data to [timestamp, price] format for datetime axis
        const series = results.map((data, index) => {
          const coin = coinOptions.find(c => c.id === selectedCoins.value[index])
          return {
            name: coin ? coin.name : selectedCoins.value[index],
            data: data?.prices ? data.prices.map(price => [price[0], price[1]]) : [] // Use [timestamp, value]
          }
        })

        chartOptions.value = {
            ...chartOptions.value, // Keep common options like yAxis
            title: { text: chartTitle },
            xAxis: {
                ...chartOptions.value.xAxis, // Keep type: 'datetime'
                // categories: undefined // Ensure categories are not used for datetime
            },
            plotOptions: { // Reset plotOptions for historical view maybe?
                 series: {
                     marker: { enabled: false }, // Example: less emphasis on markers
                     dataLabels: { enabled: false },
                 }
            },
            series
        }
      } catch (error) {
         console.error(error)
         errorMessage.value = error.message || 'An error occurred while fetching historical data.'
      } finally {
        isLoading.value = false
      }
    }

    // Update chart automatically when selected coins or time range change
    // Watch selectedRange to switch between Live and Historical modes
    watch(selectedRange, (newRange, oldRange) => {
        if (newRange !== oldRange) {
            setupChartForRange(newRange);
        }
    });

    // Watch selectedCoins - needs to re-setup the chart in either mode
    watch(selectedCoins, () => {
         // Re-run the setup for the current range
         setupChartForRange(selectedRange.value);
    }, { deep: true });

    return {
      chartRef, // Expose chartRef if needed externally (usually not)
      coinOptions,
      selectedCoins,
      chartOptions,
      rangeOptions, // Use updated rangeOptions
      selectedRange,
      isLoading,
      errorMessage,
      alertCoin,
      alertPrice,
      setPriceAlert,
      showSnackbar,
      snackbarMessage,
      realtimePrices,
      isRealtimeConnected,
      realtimeError,
    }
  }
}
</script>

<style scoped>
.ml-4 {
  margin-left: 16px;
}
</style>
