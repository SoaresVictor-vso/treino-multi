# Regras do projeto

## Especificações

- Registre as especificações em `specs/<assunto>/vN.md`.
- Cada versão deve informar data de criação, data de alteração, data de aprovação e data de implementação. Use `—` enquanto aprovação ou implementação não ocorrerem; não antecipe essas datas.
- Uma especificação pode ser alterada a qualquer momento enquanto não tiver data de implementação. Atualize a data de alteração a cada edição.
- O estado de aprovação é independente do merge; aprovação, por si só, não congela o documento. Se uma versão aprovada for alterada antes da implementação, registre a alteração e submeta o conteúdo modificado a nova aprovação antes de implementá-lo.
- Considere uma versão implementada e congele seu conteúdo somente depois que a branch referente a ela tiver sido mergeada em `master`. Até esse merge, mantenha a data de implementação como `—`, mesmo que o trabalho esteja concluído ou disponível em outra branch.
- Após o merge em `master`, preencha a data de implementação com a data efetiva do merge e preserve essa versão. Para qualquer mudança de requisito posterior ao merge, crie uma versão posterior no mesmo diretório (`v2.md`, `v3.md` etc.), com suas próprias datas, indique a versão anterior e mantenha `—` na data de implementação até que a branch dessa nova versão seja mergeada em `master`.
