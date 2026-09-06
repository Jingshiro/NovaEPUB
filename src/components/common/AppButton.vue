<template>
  <button
    :type="type"
    :class="[variantClass, disabled ? 'opacity-50 cursor-not-allowed' : '']"
    :disabled="disabled"
    @click="handleClick"
  >
    <slot>{{ label }}</slot>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, default: '' },
  variant: { type: String, default: 'primary' }, // primary | secondary | ghost | danger
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['click'])

const variantClass = computed(() => `btn-${props.variant}`)

function handleClick(e) {
  if (props.disabled) return
  emit('click', e)
}
</script>
