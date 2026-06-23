<script setup lang="ts">
import { computed } from 'vue-lynx'
import type { MTRef } from './types.js'

const MAX_STRESS_BIRDS = 400
const MAX_STRESS_FLOOD = 100

type ChipTone = {
  activeBg: string
  activeBorder: string
  inactiveText: string
}

const neutralChipStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  borderColor: 'rgba(255, 255, 255, 0.12)',
}

const greenTone: ChipTone = {
  activeBg: 'rgba(115, 191, 46, 0.6)',
  activeBorder: 'rgba(115, 191, 46, 0.4)',
  inactiveText: 'rgba(245, 255, 248, 0.88)',
}

const benchTone: ChipTone = {
  activeBg: 'rgba(232, 163, 58, 0.6)',
  activeBorder: 'rgba(232, 163, 58, 0.4)',
  inactiveText: 'rgba(255, 244, 222, 0.92)',
}

function getChipStyle(active: boolean, tone: ChipTone) {
  return active
    ? {
        backgroundColor: tone.activeBg,
        borderColor: tone.activeBorder,
      }
    : neutralChipStyle
}

function getChipTextStyle(active: boolean, tone: ChipTone) {
  return {
    color: active ? '#FFFFFF' : tone.inactiveText,
  }
}

function readInputValue(event: any): string {
  return String(event?.detail?.value ?? event?.target?.value ?? '0')
}

function clampInteger(raw: string, max: number): number {
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) return 0
  return Math.max(0, Math.min(max, parsed))
}

const props = defineProps<{
  visible: boolean

  // Debug overlay refs (passed through for MTS manipulation)
  debugTextRef: MTRef
  threadTextRef: MTRef
  mtsBtsLedRef: MTRef
  btsMtsLedRef: MTRef
  boundaryTopRef: MTRef
  boundaryBottomRef: MTRef

  // Config state (owned by Game.vue)
  birds: number
  heavy: boolean
  flood: number
  autopilot: boolean
  benchActive: boolean
  benchResult: string
}>()

const emit = defineEmits<{
  birdsChange: [n: number]
  heavyToggle: []
  floodChange: [n: number]
  autopilotToggle: []
  autoRamp: []
}>()

const pilotActive = computed(() => props.autopilot || props.benchActive)
const modeLabel = computed(() =>
  props.benchActive ? 'BENCH -> PILOT' : props.autopilot ? 'PILOT ON' : 'MANUAL',
)
const pilotTone = computed(() => (props.benchActive ? benchTone : greenTone))
const inputWrapStyle = computed(() =>
  props.benchActive ? { opacity: '0.35' } : { opacity: '1' },
)

function onPilotTap() {
  if (props.benchActive) return
  emit('autopilotToggle')
}
</script>

<template>
  <!-- Pipe spawn boundary lines -->
  <view class="debug-boundary" :main-thread-ref="boundaryTopRef" :style="{ display: 'none' }" />
  <view class="debug-boundary" :main-thread-ref="boundaryBottomRef" :style="{ display: 'none' }" />

  <!-- Unified dev HUD: debug info + thread status + stress controls -->
  <view class="dev-hud" :style="{ display: visible ? 'flex' : 'none' }">
    <view class="dev-panel">
      <view class="dev-top-row">
        <view class="dev-section dev-section-debug">
          <view class="dev-header">
            <text class="dev-title">DEBUG</text>
          </view>
          <text class="dev-debug-text" :main-thread-ref="debugTextRef">
            {{ ' ' }}
          </text>
        </view>

        <view class="dev-section dev-section-thread">
          <view class="dev-header">
            <text class="dev-title">THREAD</text>
          </view>
          <view class="dev-led-row">
            <view class="dev-led-group">
              <text class="dev-led-label">M</text>
              <view class="debug-led debug-led-mts" :main-thread-ref="mtsBtsLedRef" />
            </view>
            <view class="dev-led-group">
              <text class="dev-led-label">B</text>
              <view class="debug-led debug-led-bts" :main-thread-ref="btsMtsLedRef" />
            </view>
          </view>
          <text class="dev-thread-text" :main-thread-ref="threadTextRef">
            {{ ' ' }}
          </text>
          <view class="dev-field dev-field-thread">
            <text class="dev-field-lbl">FLOOD</text>
            <view class="dev-input-wrap dev-input-wrap-thread" :style="inputWrapStyle">
              <input
                class="dev-input"
                type="number"
                :disabled="benchActive"
                :value="String(flood)"
                @input="(e: any) => emit('floodChange', clampInteger(readInputValue(e), MAX_STRESS_FLOOD))"
              />
            </view>
          </view>
        </view>
      </view>

      <view class="dev-divider" />

      <view class="dev-section">
        <view class="dev-header dev-header-split">
          <text class="dev-title">STRESS LAB</text>
          <text class="dev-mode">{{ modeLabel }}</text>
        </view>
        <text v-if="benchResult" class="dev-result-text">{{ benchResult }}</text>

        <view class="dev-bottom-row">
          <view class="dev-field dev-field-birds">
            <text class="dev-field-lbl">BIRDS</text>
            <view class="dev-input-wrap dev-input-wrap-birds" :style="inputWrapStyle">
              <input
                class="dev-input"
                type="number"
                :disabled="benchActive"
                :value="String(birds)"
                @input="(e: any) => emit('birdsChange', clampInteger(readInputValue(e), MAX_STRESS_BIRDS))"
              />
            </view>
          </view>

          <view class="dev-field dev-field-actions">
            <text class="dev-field-lbl">MODES</text>
            <view class="dev-action-row">
              <view
                class="dev-chip dev-chip-wide"
                :style="getChipStyle(heavy, greenTone)"
                @tap="emit('heavyToggle')"
              >
                <text class="dev-chip-t" :style="getChipTextStyle(heavy, greenTone)">
                  MUT
                </text>
              </view>

              <view
                class="dev-chip dev-chip-wide"
                :style="getChipStyle(pilotActive, pilotTone)"
                @tap="onPilotTap"
              >
                <text class="dev-chip-t" :style="getChipTextStyle(pilotActive, pilotTone)">
                  PILOT
                </text>
              </view>

              <view
                class="dev-chip dev-chip-wide dev-chip-end"
                :style="getChipStyle(benchActive, benchTone)"
                @tap="emit('autoRamp')"
              >
                <text class="dev-chip-t" :style="getChipTextStyle(benchActive, benchTone)">
                  {{ benchActive ? 'STOP' : 'BENCH' }}
                </text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
