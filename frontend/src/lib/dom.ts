/** Плавно прокрутить к вопросу с номером (элемент id="q-<номер>") */
export function scrollToQuestion(number: number) {
  window.setTimeout(
    () => document.getElementById(`q-${number}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    50
  );
}
