// read_more.js
// Collapses section text by default, toggles full text and fun-fact visibility.
(function () {
    function setupReadMore() {
        var steps = document.querySelectorAll('#sections .step');
        steps.forEach(function (step) {
            var body = step.querySelector('.course-body');
            var button = step.querySelector('.read-more-btn');
            var fact = step.querySelector('.fun-fact');

            if (!body || !button || !fact) return;

            step.classList.remove('expanded');
            button.textContent = 'Read more';

            button.addEventListener('click', function () {
                var isExpanded = step.classList.contains('expanded');
                if (isExpanded) {
                    step.classList.remove('expanded');
                    button.textContent = 'Read more';
                } else {
                    step.classList.add('expanded');
                    button.textContent = 'Show less';
                }
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupReadMore);
    } else {
        setupReadMore();
    }
})();
