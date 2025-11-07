<template>
  <v-container fluid>
    <!-- Chart Selection Section -->
    <v-row>
      <v-col cols="12">
        <v-card class="mb-4" variant="outlined">
          <v-card-title class="text-h6">Chart Selection</v-card-title>
          <v-card-text class="d-flex align-center flex-wrap gap-4">
            <v-select
                v-model="selectedRange"
                :items="rangeOptions"
                label="Time Range"
                hide-details
                density="compact"
                variant="outlined"
                style="max-width: 200px;"
                class="mr-4"
            ></v-select>
            <v-select
                v-model="primaryCoin"
                :items="coinOptions"
                item-title="name"
                item-value="id"
                label="Primary Coin"
                hide-details
                density="compact"
                variant="outlined"
                style="max-width: 200px;"
                class="mr-4"
            ></v-select>

            <div class="d-flex align-center gap-4">
              <v-select
                  v-model="comparisonCoin"
                  :items="availableComparisonCoins"
                  item-title="name"
                  item-value="id"
                  label="Add Coin"
                  placeholder="Select a coin to compare"
                  hide-details
                  density="compact"
                  variant="outlined"
                  style="width: 140px"
                  class="mr-4"
              ></v-select>
              <v-tooltip text="Add a cryptocurrency for side-by-side comparison">
                <template v-slot:activator="{ props }">
                  <v-btn 
                    v-bind="props" 
                    color="primary" 
                    @click="addComparisonChart" 
                    :disabled="!comparisonCoin"
                    density="compact"
                    variant="elevated"
                    prepend-icon="mdi-plus"
                  >
                    Add
                  </v-btn>
                </template>
              </v-tooltip>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Price Alerts Section -->
    <v-row>
      <v-col cols="12">
        <v-card class="mb-4" variant="outlined">
          <v-card-title class="text-h6">Price Alerts</v-card-title>
          <v-card-text class="d-flex align-center flex-wrap gap-4">
            <v-select
                v-model="alertCoin"
                :items="coinOptions"
                item-title="name"
                item-value="id"
                label="Select Coin for Alert"
                hide-details
                density="compact"
                variant="outlined"
                class="mr-4"
                style="max-width: 200px;"
            ></v-select>
            <v-text-field
                v-model="alertPrice"
                label="Target Price (USD)"
                type="number"
                hide-details="auto"
                density="compact"
                variant="outlined"
                class="mr-4"
                style="max-width: 200px;"
                :rules="[
                  v => (v && v > 0.01) || 'Price must be greater than $0.01',
                  v => (/^\d+(\.\d{1,2})?$/.test(v) && !/^0+$/.test(v)) || 'Enter a valid positive number (no leading zeros)'
                ]"
                :disabled="!alertCoin"
            ></v-text-field>
            <v-tooltip text="Set an alert when the selected coin reaches the target price">
              <template v-slot:activator="{ props }">
                <v-btn 
                  v-bind="props" 
                  color="warning" 
                  @click="setPriceAlert"
                  :disabled="!alertCoin || !alertPrice || !isValidAlertPrice"
                  density="compact"
                  variant="elevated"
                  prepend-icon="mdi-bell"
                >
                  Set Alert
                </v-btn>
              </template>
            </v-tooltip>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Live Prices Section -->
    <v-row v-if="isRealtimeConnected && Object.keys(realtimePrices).length > 0">
      <v-col cols="12">
        <v-card outlined class="mb-4">
          <v-card-title>Live Prices (USD)</v-card-title>
          <v-card-text>
            <v-chip
              v-for="(price, id) in realtimePrices"
              :key="id"
              class="ma-1"
              :color="coinColors[id]"
              label
              text-color="white"
            >
              {{ coinOptions.find(c => c.id === id)?.name || id }}: ${{ parseFloat(price).toFixed(2) }}
            </v-chip>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Loading and Error States -->
    <v-row v-if="isLoading">
      <v-col cols="12">
        <v-progress-linear indeterminate color="primary" class="mb-4"></v-progress-linear>
      </v-col>
    </v-row>
    <v-row v-if="errorMessage">
      <v-col cols="12">
        <v-alert type="error" dismissible class="mb-4">
          {{ errorMessage }}
        </v-alert>
      </v-col>
    </v-row>

    <!-- Charts Section -->
    <v-row>
      <v-col
        v-for="coinId in selectedCoins"
        :key="coinId"
        cols="12"
        :md="selectedCoins.length > 1 ? 6 : 12"
      >
        <v-card>
          <v-card-title class="text-center position-relative">
            {{ coinOptions.find(c => c.id === coinId)?.name }}
            <v-btn
              v-if="coinId !== primaryCoin"
              size="small"
              variant="text"
              @click="removeChart(coinId)"
              style="position: absolute; top: 50%; right: 16px; transform: translateY(-50%);"
            >
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </v-card-title>
          <v-card-text>
            <highcharts v-if="chartOptions[coinId]" :options="chartOptions[coinId]" :ref="el => setChartRef(coinId, el)" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Snackbar for Alerts -->
    <v-snackbar v-model="showSnackbar" timeout="5000" color="success">
      {{ snackbarMessage }}
    </v-snackbar>
  </v-container>
</template>

<script>
import { ref, onMounted, watch, toRaw, computed } from 'vue'
import { storeToRefs } from 'pinia'
import axios from 'axios'
import { db } from '../firebase.js'
import { collection, addDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore'
import { useRealtimeCryptoData } from '../composables/useRealtimeCryptoData'
import { useSettingsStore } from '../store/settings'
import Highcharts from 'highcharts';
import { Chart } from 'highcharts-vue';

export default {
  name: 'CryptoChart',
  components: {
    highcharts: Chart
  },
  setup() {
    const settingsStore = useSettingsStore();
    const {
      selectedCoins,
      selectedRange,
      alertCoin,
      alertPrice,
    } = storeToRefs(settingsStore);

    const primaryCoin = ref(selectedCoins.value[0] || 'bitcoin');
    const comparisonCoin = ref(null);

    const availableComparisonCoins = computed(() => {
      return coinOptions.filter(c => !selectedCoins.value.includes(c.id));
    });

    const MAX_LIVE_POINTS = 120;

    const coinOptions = [
      { id: 'bitcoin', name: 'Bitcoin' },
      { id: 'ethereum', name: 'Ethereum' },
      { id: 'litecoin', name: 'Litecoin' },
    ]
    const coinColors = {
      bitcoin: 'red',
      ethereum: 'green',
      litecoin: 'blue',
    };

    const chartRefs = ref({});
    const setChartRef = (coinId, el) => {
      if (el) {
        chartRefs.value[coinId] = el;
      }
    };
    const chartOptions = ref({});
    const rangeOptions = [
      { title: 'Live (Last Hour)', value: 1 },
      { title: '7 Days', value: 7 },
      { title: '30 Days', value: 30 }
    ]
    const isLoading = ref(false)
    const errorMessage = ref('')
    const priceAlerts = ref([])
    const showSnackbar = ref(false)
    const snackbarMessage = ref('')

    const {
      prices: realtimePrices,
      isConnected: isRealtimeConnected,
      error: realtimeError
    } = useRealtimeCryptoData(selectedCoins)

    onMounted(() => {
      if (selectedCoins.value.length === 0) {
        selectedCoins.value.push('bitcoin');
      }
      primaryCoin.value = selectedCoins.value[0];

      const alertsCol = collection(db, 'priceAlerts');
      onSnapshot(alertsCol, snapshot => {
        priceAlerts.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      });
      selectedCoins.value.forEach(coinId => {
        setupChartForRange(selectedRange.value, coinId);
      });
    });

    const addComparisonChart = () => {
      if (comparisonCoin.value && !selectedCoins.value.includes(comparisonCoin.value)) {
        selectedCoins.value.push(comparisonCoin.value);
        setupChartForRange(selectedRange.value, comparisonCoin.value);
        comparisonCoin.value = null; // Reset the dropdown
      }
    };

    const removeChart = (coinId) => {
      const index = selectedCoins.value.indexOf(coinId);
      if (index > -1) {
        // Create a new array to ensure watchers trigger correctly.
        selectedCoins.value = selectedCoins.value.filter(c => c !== coinId);
        delete chartOptions.value[coinId];
        delete chartRefs.value[coinId];
      }
    };

    const checkLivePriceAlerts = async () => {
      const currentPrices = realtimePrices.value;
      if (!currentPrices || Object.keys(currentPrices).length === 0) return;

      for (const alert of priceAlerts.value) {
        const livePrice = currentPrices[alert.coinId];
        if (livePrice !== undefined) {
          const numericLivePrice = Number(livePrice);
          if (numericLivePrice >= alert.targetPrice) {
            const coinName = coinOptions.find(c => c.id === alert.coinId)?.name || alert.coinId;
            snackbarMessage.value = `LIVE Alert: ${coinName} has reached $${numericLivePrice.toFixed(2)}`;
            showSnackbar.value = true;
            try {
              await deleteDoc(doc(db, 'priceAlerts', alert.id));
            } catch (error) {
               console.error(`Error deleting alert ${alert.id}:`, error);
            }
          }
        }
      }
    };

    const setPriceAlert = async () => {
      if (!alertCoin.value || !alertPrice.value) return
      try {
        const alertsCol = collection(db, 'priceAlerts')
        await addDoc(alertsCol, {
          coinId: alertCoin.value,
          targetPrice: Number(alertPrice.value),
          createdAt: new Date()
        })
        alertCoin.value = 'bitcoin';
        alertPrice.value = '';
      } catch (error) {
        console.error("Error setting price alert:", error)
      }
    }

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

    watch(realtimePrices, (newPrices) => {
      if (!isRealtimeConnected.value || selectedRange.value !== 1) {
          return;
      }
      if (!newPrices || Object.keys(newPrices).length === 0) return;

      Object.entries(newPrices).forEach(([coinId, price]) => {
        const chart = chartRefs.value[coinId]?.chart;
        if (!chart) return;
        
        const numericPrice = Number(price);
        const timestamp = Date.now();
        const series = chart.series[0]; // Assuming one series per chart
        if (series) {
          const shift = series.data.length >= MAX_LIVE_POINTS;
          series.addPoint([timestamp, numericPrice], true, shift);
        }
      });

      checkLivePriceAlerts();
    }, { deep: true });

    function setupChartForRange(range, coinId) {
        const existingChart = chartRefs.value[coinId]?.chart;
        if (existingChart) {
            while (existingChart.series.length > 0) {
                 existingChart.series[0].remove(false);
            }
            existingChart.redraw();
        }

        if (range === 1) {
            isLoading.value = true;
            errorMessage.value = '';
            fetchLastHourData(coinId).then(historicalData => {
                chartOptions.value[coinId] = createChartOptions(historicalData);
                
                if (historicalData.data.length > 0) {
                    const lastPrice = historicalData.data[historicalData.data.length - 1][1];
                    realtimePrices.value[coinId] = lastPrice;
                }

                isLoading.value = false;
            }).catch(err => {
                errorMessage.value = `Failed to fetch data for ${coinId}.`;
                isLoading.value = false;
            });
        } else {
            updateChart(coinId);
        }
    }
    
    function createChartOptions(seriesData) {
      const coinName = coinOptions.find(c => c.id === seriesData.id)?.name || seriesData.id;
      const color = coinColors[seriesData.id] || '#000000';
      return {
        accessibility: { enabled: false },
        chart: { type: 'line', zoomType: 'x' },
        title: { text: null },
        xAxis: { type: 'datetime' },
        yAxis: { title: { text: null }, labels: { format: '${value:,.0f}' } },
        legend: {
          enabled: false
        },
        tooltip: {
          formatter: function() {
            return `<b>${new Date(this.x).toLocaleTimeString()}</b><br/>${this.series.name}: <b>$${this.y.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</b>`;
          }
        },
        series: [{
          name: coinName,
          data: seriesData.data,
          id: seriesData.id,
          color: color
        }]
      };
    }

    async function fetchLastHourData(coinId) {
        if (!coinId) return [];
        try {
            const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`, {
                params: {
                    vs_currency: 'usd',
                    days: 1
                }
            });
            const now = Date.now();
            const oneHourAgo = now - (60 * 60 * 1000); 
            const lastHourPrices = response.data.prices.filter(([timestamp]) => timestamp >= oneHourAgo);
            
            return {
                data: lastHourPrices,
                id: coinId
            };
        } catch (error) {
            console.error(`Error fetching last hour data for ${coinId}:`, error);
            throw new Error(`Failed to fetch last hour data for ${coinId}.`);
        }
    }

    const updateChart = async (coinId) => {
      isLoading.value = true
      errorMessage.value = ''
      try {
        const data = await fetchCoinData(coinId);
        const seriesData = {
          data: data?.prices ? data.prices.map(price => [price[0], price[1]]) : [],
          id: coinId
        };
        chartOptions.value[coinId] = createChartOptions(seriesData);

        if (seriesData.data.length > 0) {
            const lastPrice = seriesData.data[seriesData.data.length - 1][1];
            realtimePrices.value[coinId] = lastPrice;
        }
      } catch (error) {
         console.error(error)
         errorMessage.value = error.message || 'An error occurred while fetching historical data.'
      } finally {
        isLoading.value = false
      }
    }

    watch(selectedRange, (newRange) => {
        selectedCoins.value.forEach(coinId => {
            setupChartForRange(newRange, coinId);
        });
    });

    watch(primaryCoin, (newCoin, oldCoin) => {
      if (newCoin && oldCoin && newCoin !== oldCoin) {
        const index = selectedCoins.value.indexOf(oldCoin);
        if (index !== -1) {
          // Create a new array to ensure watchers trigger correctly,
          // by replacing the old primary coin with the new one.
          const newSelectedCoins = [...selectedCoins.value];
          newSelectedCoins[index] = newCoin;
          selectedCoins.value = newSelectedCoins;

          // Clean up the old chart and create the new one
          delete chartOptions.value[oldCoin];
          delete chartRefs.value[oldCoin];
          setupChartForRange(selectedRange.value, newCoin);
        }
      }
    });

    const isValidAlertPrice = computed(() => {
      return alertPrice.value !== null && alertPrice.value !== undefined && alertPrice.value > 0.01 && alertPrice.value <= 10000000 && (/^\d+(\.\d{1,2})?$/.test(alertPrice.value) && !/^0+$/.test(alertPrice.value));
    });

    return {
      chartRefs,
      setChartRef,
      coinOptions,
      selectedCoins,
      chartOptions,
      rangeOptions,
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
      primaryCoin,
      comparisonCoin,
      availableComparisonCoins,
      addComparisonChart,
      removeChart,
      coinColors,
      isValidAlertPrice
    }
  }
}
</script>

<style scoped>
.ml-4 {
  margin-left: 16px;
}
</style>
