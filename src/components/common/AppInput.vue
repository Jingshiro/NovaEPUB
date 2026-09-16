<template>
  <label v-if="label" class="flex items-center gap-3">
    <span class="label">{{ label }}</span>
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      class="input"
      @input="onInput"
    />
  </label>
  <input
    v-else
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    class="input"
    @input="onInput"
  />
</template>

<script setup>
defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

function onInput(e) {
  emit('update:modelValue', e.target.value)
}
</script>
