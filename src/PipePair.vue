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
      <image :src="pipeGreen" class="pipe-top-img" />
    </view>
    <view class="pipe-bottom" :main-thread-ref="botRef">
      <image :src="pipeGreen" class="pipe-bottom-img" />
    </view>
    <view class="pipe-gap-zone" :main-thread-ref="gapRef" :style="{ display: 'none' }" />
  </view>
</template>
