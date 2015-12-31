<?php

include 'Header.php';
include 'Navigation.php';
include 'Page.php';
include 'PageMeta.php';

$pagesMeta = array(
	new PageMeta('ChipPanFire', 'index.html', 'content-homepage.phtml'),
	new PageMeta('Music', 'music.html', 'content-music.phtml'),
	new PageMeta('Contact', 'contact.html', 'content-contact.phtml')
);

$navigation = new Navigation($pagesMeta);

$pages = array();
foreach ($pagesMeta as $pageMeta) {
	$pages[] = new Page($pageMeta, $navigation);
}

ob_start();
foreach ($pages as $page) {
	# code...
	$page->render();
	file_put_contents('site/' . $page->filename(), ob_get_contents());
	ob_clean();
}
ob_end_clean();




// Get the content that is in the buffer and put it in your file //



