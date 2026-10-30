<script setup lang="ts">
import { BRAND, copyrightLine } from '../../../packages/config/src/brand';
const [before, after] = copyrightLine().split(BRAND.company.name) as [string, string];
</script>

<template>
  <footer class="qroove-footer">
    <p>
      {{ before }}<a :href="BRAND.company.url" rel="noopener">{{ BRAND.company.name }}</a
      >{{ after }}
    </p>
    <p>
      <a :href="BRAND.repoUrl" rel="noopener">Source</a> ·
      <a :href="`${BRAND.docsPath}/license`">License</a> · <a href="/">Open the app</a>
    </p>
  </footer>
</template>
