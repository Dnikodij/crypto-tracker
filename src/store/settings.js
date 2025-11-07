import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export const useSettingsStore = defineStore('settings', () => {
  const defaultCoins = ['bitcoin'];
  const storedSettings = JSON.parse(localStorage.getItem('cryptoSettings'));

  const selectedCoins = ref(storedSettings?.selectedCoins || defaultCoins);
  const selectedRange = ref(storedSettings?.selectedRange || 1);
  const alertCoin = ref(storedSettings?.alertCoin || 'bitcoin');
  const alertPrice = ref(storedSettings?.alertPrice || '');

  watch([selectedCoins, selectedRange, alertCoin, alertPrice], () => {
    const settings = {
      selectedCoins: selectedCoins.value,
      selectedRange: selectedRange.value,
      alertCoin: alertCoin.value,
      alertPrice: alertPrice.value,
    };
    localStorage.setItem('cryptoSettings', JSON.stringify(settings));
  }, { deep: true });

  return {
    selectedCoins,
    selectedRange,
    alertCoin,
    alertPrice,
  };
});
