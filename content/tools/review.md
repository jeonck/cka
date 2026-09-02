---
title: Review session
script: review
weight: 1
summary: Keyboard-driven flashcard and cloze review, scheduled by SM-2.
---

Flashcards and cloze drills, ordered by an SM-2 scheduler: overdue items first, then anything you have never seen.
Everything is keyboard-driven — <kbd>Space</kbd> reveals, <kbd>1</kbd>–<kbd>4</kbd> grade, <kbd>s</kbd> skips.

<div class="toolbar">
  <label>Domain {{< domain-select id="fDomain" >}}</label>
  <label>Type
    <select id="fType">
      <option value="all">Flashcards + cloze</option>
      <option value="flashcards">Flashcards only</option>
      <option value="cloze">Cloze only</option>
    </select>
  </label>
  <label>Session size
    <select id="fLimit">
      <option>10</option><option selected>20</option><option>40</option><option>100</option>
    </select>
  </label>
  <button id="fStart" class="btn">New session</button>
</div>

<div id="review"></div>

<details id="keyhelp" class="small">
  <summary>Grading, and what each button does to the schedule</summary>
  <ul>
    <li><kbd>1</kbd> <b>Again</b> — repetition count resets, item returns tomorrow, ease drops.</li>
    <li><kbd>2</kbd> <b>Hard</b> — correct but slow; interval grows, ease drops slightly.</li>
    <li><kbd>3</kbd> <b>Good</b> — the normal answer; ease unchanged.</li>
    <li><kbd>4</kbd> <b>Easy</b> — instant recall; ease rises and the interval stretches.</li>
  </ul>
  <p class="muted">The number on each button is its <strong>keyboard shortcut</strong>, not a count. Underneath it is
  when the item comes back if you press it.</p>
  <p class="muted">Intervals run 1 day, 6 days, then previous × ease. Ease starts at 2.5 and never falls below 1.3.
  So a brand-new item shows <em>in 1 day</em> on all four buttons — at SM-2's first step only Again versus not-Again
  changes anything, and the four intervals start separating from the third review onward. Grade honestly: an inflated
  grade buys you a card you will not see again before the exam.</p>
</details>
