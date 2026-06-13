<script setup>
// Groups aren't part of the data model yet — placeholder for now.
</script>

<template>
  <section>
    <h1 class="text-[22px] font-bold text-slate-900 dark:text-white">Groups</h1>
    <p class="text-[13px] text-slate-500 dark:text-white/45 mt-0.5 mb-4">Organise users into groups</p>

    <div class="rounded-2xl bg-white/60 dark:bg-white/[0.04] backdrop-blur-md border border-white/70 dark:border-white/10 py-14 flex flex-col items-center gap-3 text-center">
      <svg class="w-10 h-10 text-slate-300 dark:text-white/20" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
      <p class="text-sm font-medium text-slate-500 dark:text-white/50">No groups yet</p>
      <p class="text-xs text-slate-400 dark:text-white/35 max-w-xs">Groups will let you bundle users and control which apps each group can access.</p>
    </div>
  </section>
</template>
