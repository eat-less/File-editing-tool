<template>
  <el-select v-model="selectedValue" :multiple="multiple" :placeholder="placeholder" style="width:100%">
    <el-option-group v-for="ex in projectStore.exhibits" :key="ex.id" :label="ex.name">
      <el-option v-for="d in getDevicesByExhibit(ex.id)" :key="d.id" :label="`${d.name} (${d.unique_code})`" :value="d.id">
        <span>{{ d.name }}</span>
        <el-tag size="small" style="margin-left:8px" :type="d.status === 'online' ? 'success' : 'info'">{{ d.status }}</el-tag>
      </el-option>
    </el-option-group>
  </el-select>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '@/stores/project'

const props = defineProps<{ multiple?: boolean; placeholder?: string }>()
const projectStore = useProjectStore()
const selectedValue = ref<string | string[]>(props.multiple ? [] : '')

function getDevicesByExhibit(_exhibitId: string) {
  return projectStore.devices || []
}
</script>
