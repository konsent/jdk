---
layout: default
title: 명예의 전당
---

<style>
  .honor-group { width: 100%; max-width: 500px; margin: 0 auto 40px; }
  .honor-title { font-size: 1.6em; font-weight: bold; margin: 30px 0 10px; }
  .honor-row { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); padding-bottom: 14%; }
  /* 흰 배경 jpg를 월계수 위에 겹치기 위해 multiply로 흰색을 투명처럼 처리 */
  .honor-row img.member { position: relative; z-index: 1; width: 100%; mix-blend-mode: multiply; }
  .honor-row img.member:nth-child(2) { transform: translateY(14%); }
  .honor-row img.laurel { position: absolute; left: 0; bottom: 0; width: 100%; }
</style>

<div id="contact" style="display: flex; flex-direction: column; align-items: center; text-align: center;">
  <h1 class="pageTitle">장단콩즈 명예의 전당</h1>
	<a>장단콩즈의 창립멤버와 장단콩즈를 위해 후원해주신 연회원분들을 소개하는 공간입니다. </a>

  {% for group in site.data.honor %}
  <div class="honor-group">
    {% if group.title %}<div class="honor-title">{{ group.title }}</div>{% endif %}
    <div class="honor-row">
      {% for m in group.members %}
      <img class="member" src="{{ '/assets/honor/' | append: m | append: '.jpg' | relative_url | uri_escape }}" alt="{{ m }}">
      {% endfor %}
      <img class="laurel" src="{{ '/assets/honor/laurel-' | append: group.laurel | append: '.png' | relative_url }}" alt="">
    </div>
  </div>
  {% endfor %}
</div>
