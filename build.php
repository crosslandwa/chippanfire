<?php

error_reporting(E_STRICT);

include 'src/Header.php';
include 'src/Navigation.php';
include 'src/Page.php';
include 'src/PageMeta.php';
include 'src/Site.php';

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
