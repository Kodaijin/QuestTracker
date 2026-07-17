# 2026-06-22: Leave a shared quest


- Party members can now **leave a shared quest** from its page (the Party card shows a "Leave quest" button for non-owners). New `leaveQuest` action in `src/app/actions/party.ts` removes just that member's `QuestMember` row; the quest stays for the owner and others, and the leaver's already-earned XP is untouched. Owners still delete rather than leave
