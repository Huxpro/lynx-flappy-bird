<script setup lang="ts">
import type { MTRef } from './types.js'

import pipeGreen from '../assets/sprites/pipe-green.png'

defineProps<{
  pipeRef: MTRef
  topRef: MTRef
  botRef: MTRef
  gapRef: MTRef
}>()
</script>

<template>
  <view class="pipe-pair" :main-thread-ref="pipeRef" :style="{ left: '9999px' }">
    <view class="pipe-top" :main-thread-ref="topRef">
      <view class="pipe-fill" />
      <image :src="pipeGreen" class="pipe-cap-img" />
    </view>
    <view class="pipe-bottom" :main-thread-ref="botRef">
      <view class="pipe-fill" />
      <image :src="pipeGreen" class="pipe-cap-img" />
    </view>
    <view class="pipe-gap-zone" :main-thread-ref="gapRef" :style="{ display: 'none' }" />
  </view>
</template>
