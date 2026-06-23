<script setup lang="ts">
import { computed } from 'vue-lynx'

import replayImg from '../assets/sprites/replay.png'
import medalBronze from '../assets/sprites/medal_bronze.png'
import medalSilver from '../assets/sprites/medal_silver.png'
import medalGold from '../assets/sprites/medal_gold.png'
import medalPlatinum from '../assets/sprites/medal_platinum.png'

import ScoreDigits from './ScoreDigits.vue'

const props = defineProps<{
  score: number
  bestScore: number
}>()

const emit = defineEmits<{ replay: [] }>()

function getMedalSrc(score: number): string | null {
  if (score >= 40) return medalPlatinum
  if (score >= 30) return medalGold
  if (score >= 20) return medalSilver
  if (score >= 10) return medalBronze
  return null
}

const medalSrc = computed(() => getMedalSrc(props.score))
</script>

<template>
  <view class="overlay">
    <view class="gameover-panel">
      <image v-if="medalSrc" :src="medalSrc" class="medal" />

      <ScoreDigits
        :value="score"
        container-class-name="panel-score"
        digit-class-name="panel-digit"
        key-prefix="ps"
      />

      <ScoreDigits
        :value="bestScore"
        container-class-name="panel-best"
        digit-class-name="panel-digit"
        key-prefix="pb"
      />

      <view class="replay-button" @tap="emit('replay')">
        <image :src="replayImg" class="replay-img" />
      </view>
    </view>
  </view>
</template>
