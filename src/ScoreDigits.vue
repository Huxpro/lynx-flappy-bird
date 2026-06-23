<script setup lang="ts">
import { computed } from 'vue-lynx'

import digit0 from '../assets/sprites/digits/0.png'
import digit1 from '../assets/sprites/digits/1.png'
import digit2 from '../assets/sprites/digits/2.png'
import digit3 from '../assets/sprites/digits/3.png'
import digit4 from '../assets/sprites/digits/4.png'
import digit5 from '../assets/sprites/digits/5.png'
import digit6 from '../assets/sprites/digits/6.png'
import digit7 from '../assets/sprites/digits/7.png'
import digit8 from '../assets/sprites/digits/8.png'
import digit9 from '../assets/sprites/digits/9.png'

const digitImages = [
  digit0, digit1, digit2, digit3, digit4,
  digit5, digit6, digit7, digit8, digit9,
]

/**
 * Renders a number as a row of sprite digit images.
 * Used for both the in-game HUD score and the game-over panel scores.
 */
const props = withDefaults(
  defineProps<{
    value: number
    containerClassName: string
    digitClassName: string
    keyPrefix?: string
  }>(),
  { keyPrefix: 'd' },
)

const digitSrcs = computed(() =>
  String(props.value)
    .split('')
    .map((d) => digitImages[parseInt(d, 10)]!),
)
</script>

<template>
  <text :class="containerClassName">
    <image
      v-for="(src, i) in digitSrcs"
      :key="`${keyPrefix}-${i}`"
      :src="src"
      :class="digitClassName"
    />
  </text>
</template>
