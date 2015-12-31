<?php

class PageMeta {
	private $_title;
	private $_filename;
    private $_contentFilename;

    function __construct($title, $filename, $contentFilename) {
        $this->_title = $title;
        $this->_filename = $filename;
        $this->_contentFilename = $contentFilename;
    }

    function title() {
    	return $this->_title;
    }

    function filename() {
    	return $this->_filename;
    }

    function contentFilename() {
        return $this->_contentFilename;
    }
}