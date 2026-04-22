<script lang="ts">
  export let issues: string[] = [];
</script>

<div class="vha-svelte-placeholder">
  <h3>Issues</h3>
  {#if issues.length === 0}
    <p>Sem issues.</p>
  {:else}
    <ul>
      {#each issues as issue}
        <li>{issue}</li>
      {/each}
    </ul>
  {/if}
</div>
