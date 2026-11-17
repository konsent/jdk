---
layout: default
title: 명예의 전당
---

<style>
  .honor-group { width: 100%; max-width: 600px; margin: 0 auto 40px; }
  .honor-title { font-size: 1.6em; font-weight: bold; margin: 30px 0 10px; }
  .honor-row { position: relative; display: flex; justify-content: center; padding-bottom: 12%; }
  /* 흰 배경 jpg를 월계수 위에 겹치기 위해 multiply로 흰색을 투명처럼 처리. 여백이 커서 살짝 겹쳐 배치 */
  .honor-row img.member { position: relative; z-index: 1; width: 37%; margin: 0 -2%; mix-blend-mode: multiply; }
  /* 3명일 때만 가운데를 아래로 */
  .honor-row img.member:nth-child(2):nth-last-child(3) { transform: translateY(14%); }
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
