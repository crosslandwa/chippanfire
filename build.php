<?php

include 'Header.php';
include 'Navigation.php';
include 'Page.php';
include 'PageMeta.php';
include 'Site.php';

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

$site = new Site($pages);
$site->render();
