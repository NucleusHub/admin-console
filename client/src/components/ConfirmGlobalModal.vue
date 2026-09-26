<script setup>
import { Icon } from '@core/icons'
defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Confirm' },
  danger: { type: Boolean, default: false },
})
defineEmits(['confirm', 'cancel'])
</script>

<template>
  <Teleport to="body">
    <Transition name="gm-fade">
      <div v-if="show" class="fixed inset-0 z-[210] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-md" @click="$emit('cancel')" />
        <div class="relative w-full max-w-sm rounded-2xl bg-white/95 dark:bg-slate-900/96 border border-white/60 dark:border-white/10 shadow-2xl overflow-hidden">
          <div class="p-5">
            <h2 class="text-base font-semibold text-slate-900 dark:text-white">{{ title }}</h2>
            <p class="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{{ message }}</p>

            <div class="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2.5">
              <Icon name="warning" class="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
              <p class="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                This is a <strong>global action</strong> — it applies to <strong>every user</strong>, not just you.
              </p>
            </div>
          </div>

          <div class="px-5 py-4 border-t border-slate-200/70 dark:border-white/8 flex gap-2 justify-end">
            <button
              @click="$emit('cancel')"
              class="cursor-pointer px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
            >Cancel</button>
            <button
              @click="$emit('confirm')"
              class="cursor-pointer px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
              :class="danger ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'"
            >{{ confirmLabel }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.gm-fade-enter-active, .gm-fade-leave-active { transition: opacity 0.15s ease; }
.gm-fade-enter-from, .gm-fade-leave-to { opacity: 0; }
</style>
