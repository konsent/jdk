// A $( document ).ready() block.
$( document ).ready(function() {

	// DropCap.js
	var dropcaps = document.querySelectorAll(".dropcap");
	window.Dropcap.layout(dropcaps, 2);

	// Responsive-Nav
	var nav = responsiveNav(".nav-collapse");

	// Round Reading Time
    $(".time").text(function (index, value) {
      return Math.round(parseFloat(value));
    });

	// Fancybox 초기화
	$(".fancybox").fancybox({
		openEffect: "none",
		closeEffect: "none"
	});

	// Hover 이벤트로 확대 효과 적용
	$(".zoom").hover(function(){
		$(this).addClass('transition');
	}, function(){
		$(this).removeClass('transition');
	});

});
