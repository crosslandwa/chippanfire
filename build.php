<?php

error_reporting(E_ALL);
ini_set('display_errors', 1);

include 'src/Header.php';
include 'src/Navigation.php';
include 'src/Page.php';
include 'src/PageMeta.php';
include 'src/Site.php';

$pagesMeta = array(
	new PageMeta('ChipPanFire', 'index.html', 'template/content-homepage.phtml'),
	new PageMeta('Music', 'music.html', 'template/content-music.phtml'),
	new PageMeta('Contact', 'contact.html', 'template/content-contact.phtml')
);

$navigation = new Navigation($pagesMeta);

$pages = array();
foreach ($pagesMeta as $pageMeta) {
	$pages[] = new Page($pageMeta, $navigation);
}

$site = new Site($pages);
$site->render();
