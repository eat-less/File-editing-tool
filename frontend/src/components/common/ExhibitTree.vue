<template>
  <div class="exhibit-tree">
    <el-input v-model="searchText" size="small" placeholder="搜索..." clearable style="margin-bottom:8px" />
    <el-tree
      :data="treeData"
      :props="treeProps"
      node-key="id"
      :filter-node-method="filterNode"
      :default-expand-all="true"
      @node-click="onNodeClick"
      ref="treeRef"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useProjectStore } from '@/stores/project'

const props = defineProps<{ onSelect?: (type: string, data: any) => void }>()
const emit = defineEmits(['select'])
const projectStore = useProjectStore()
const searchText = ref('')
const treeRef = ref()

const treeProps = { children: 'children', label: 'label' }

const treeData = computed(() => {
  return projectStore.exhibits.map(ex => ({
    id: ex.id, label: `${ex.name} (S:${ex.scene_count} D:${ex.device_count})`,
    type: 'exhibit',
    children: []
  }))
})

watch(searchText, (val) => {
  treeRef.value?.filter(val)
})

function filterNode(value: string, data: any) {
  if (!value) return true
  return data.label?.includes(value)
}

function onNodeClick(data: any) {
  emit('select', data.type, data)
}

onMounted(async () => {
  if (projectStore.exhibits.length === 0) {
    await projectStore.fetchExhibits()
  }
})
</script>
